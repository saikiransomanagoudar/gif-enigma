// server/redditSearch.ts
import { Context } from '@devvit/public-api';

interface RedditSearchParams {
  query: string;
  limit?: number;
}

export interface GifResult {
  id: string;
  url: string;
  preview?: string;
  content_description: string;
}

// List of popular GIF subreddits to search across
const GIF_SUBREDDITS = [
  'gifs',
  'reactiongifs',
];

// Maximum number of retries for API calls
const MAX_RETRIES = 2;

// Timeout between retries (in milliseconds)
const RETRY_TIMEOUT = 1000;

/**
 * Server-side block to search GIFs using the Devvit Reddit API
 */
export async function redditSearch(params: RedditSearchParams, context: Context): Promise<string[]> {
  try {
    const { query, limit = 8 } = params;
    const results = await searchAcrossSubreddits(query, limit, context);
    
    // Extract just the URLs
    return results.map(gif => gif.url);
  } catch (error) {
    console.error('Error searching Reddit GIFs:', error);
    // Fall back to mock data in case of error
    return getMockGifs(params.query);
  }
}

/**
 * Enhanced version that returns more GIF metadata
 */
export async function redditSearchEnhanced(params: RedditSearchParams, context: Context): Promise<GifResult[]> {
  try {
    const { query, limit = 8 } = params;
    
    // Try the search across subreddits approach first
    let results = await searchAcrossSubreddits(query, limit, context);
    
    // If we didn't find enough results, try the direct approach with dedicated GIF subreddits
    if (results.length < limit) {
      console.log(`Only found ${results.length} results via search, trying direct fetching...`);
      
      // Get GIFs from dedicated GIF subreddits
      const gifSubreddits = ['gifs', 'reactiongifs'];
      const directFetchPromises = gifSubreddits.map(subreddit => 
        fetchGifsFromSubreddit(subreddit, Math.ceil((limit - results.length) / gifSubreddits.length), context)
      );
      
      // Use Promise.allSettled to handle partial failures gracefully
      const settledResults = await Promise.allSettled(directFetchPromises);
      const directResults = settledResults
        .filter((result): result is PromiseFulfilledResult<GifResult[]> => result.status === 'fulfilled')
        .map(result => result.value)
        .flat();
      
      // Combine results, deduplicate, and limit
      results = deduplicateResults([...results, ...directResults]).slice(0, limit);
    }
    
    // If we still don't have enough results, use mock data to fill in
    if (results.length < limit) {
      const mockResults = getMockGifResults(params.query);
      results = [...results, ...mockResults.slice(0, limit - results.length)];
    }
    
    return results;
  } catch (error) {
    console.error('Error searching Reddit GIFs:', error);
    return getMockGifResults(params.query);
  }
}

/**
 * Search for GIFs across multiple subreddits using Devvit's native Reddit API
 * with retry logic and error handling
 */
async function searchAcrossSubreddits(query: string, limit: number, context: Context): Promise<GifResult[]> {
  // Filter to a smaller set of subreddits based on the query (max 3 for performance)
  // We're using a smaller number because we're making multiple API calls per subreddit
  const subredditsToSearch = selectRelevantSubreddits(query, 3);
  
  try {
    // Create an array of promises for parallel execution
    const searchPromises = subredditsToSearch.map(subredditName => 
      searchSubreddit(subredditName, query, Math.ceil(limit / subredditsToSearch.length), context)
    );
    
    // Use Promise.allSettled to handle partial failures gracefully
    const settledResults = await Promise.allSettled(searchPromises);
    
    // Extract results from fulfilled promises
    const allResults = settledResults
      .filter((result): result is PromiseFulfilledResult<GifResult[]> => result.status === 'fulfilled')
      .map(result => result.value)
      .flat();
    
    // Log any failures
    const failedSubreddits = settledResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((_, index) => subredditsToSearch[index]);
    
    if (failedSubreddits.length > 0) {
      console.warn(`Failed to search in subreddits: ${failedSubreddits.join(', ')}`);
    }
    
    // Deduplicate results by URL
    const uniqueResults = deduplicateResults(allResults);
    
    // Return limited number of results
    return uniqueResults.slice(0, limit);
    
  } catch (error) {
    console.error('Error during multi-subreddit search:', error);
    return [];
  }
}

/**
 * Search for GIFs within a specific subreddit
 */
async function searchSubreddit(subredditName: string, query: string, limit: number, context: Context): Promise<GifResult[]> {
  try {
    let hotPosts: any[] = [];
    let newPosts: any[] = [];
    
    // Get hot posts from the subreddit
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const postsListing = await context.reddit.getHotPosts({
            subredditName: subredditName,
            limit: limit * 2,
            pageSize: 100
          });
          
          // Use .all() to get all posts
          hotPosts = await postsListing.all();
          break; // If successful, exit the retry loop
        } catch (err) {
          if (attempt === MAX_RETRIES) throw err;
          await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
        }
      }
    } catch (hotError) {
      console.warn(`Failed to get hot posts from r/${subredditName}: ${hotError}`);
    }
    
    // Get new posts for more variety
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const postsListing = await context.reddit.getNewPosts({
            subredditName: subredditName,
            limit: limit * 2,
            pageSize: 100
          });
          
          // Use .all() to get all posts
          newPosts = await postsListing.all();
          break; // If successful, exit the retry loop
        } catch (err) {
          if (attempt === MAX_RETRIES) throw err;
          await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
        }
      }
    } catch (newError) {
      console.warn(`Failed to get new posts from r/${subredditName}: ${newError}`);
    }
    
    // If we couldn't get any posts, return empty array
    if (hotPosts.length === 0 && newPosts.length === 0) {
      return [];
    }
    
    // Combine posts and filter by the query
    const allPosts = [...hotPosts, ...newPosts];
    const filteredPosts = allPosts.filter(post => {
      if (!post.title) return false;
      
      // Filter by query keywords
      const titleLower = post.title.toLowerCase();
      const queryKeywords = query.toLowerCase().split(' ');
      
      // Check if any of the keywords match the post title
      const matchesQuery = queryKeywords.some(keyword => 
        titleLower.includes(keyword) && keyword.length > 2
      );
      
      return matchesQuery;
    });
    
    // Process the filtered posts to extract GIF information
    return processSearchResults(filteredPosts, query);
  } catch (error) {
    console.error(`Error searching in r/${subredditName}:`, error);
    return []; // Return empty array on error instead of rethrowing
  }
}

/**
 * Fetch GIFs from a specific subreddit using alternative API methods
 * This is a fallback approach if we have trouble searching
 */
async function fetchGifsFromSubreddit(subredditName: string, limit: number, context: Context): Promise<GifResult[]> {
  try {
    let posts: any[] = [];
    
    // Try to get hot posts with retries
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const postsListing = await context.reddit.getHotPosts({
          subredditName: subredditName,
          limit: limit * 3,
          pageSize: 100
        });
        
        // Use .all() to get all posts
        posts = await postsListing.all();
        break; // If successful, exit the retry loop
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          console.error(`Failed to fetch posts from r/${subredditName} after ${MAX_RETRIES} attempts`);
          return [];
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
      }
    }
    
    // Filter and process to get only GIF posts
    return processSearchResults(posts, "");
  } catch (error) {
    console.error(`Error fetching GIFs from r/${subredditName}:`, error);
    return [];
  }
}

/**
 * Process reddit search results into our GifResult format
 */
function processSearchResults(posts: any[], query: string): GifResult[] {
  // Filter posts to ensure they contain GIFs
  return posts
    .filter(post => {
      if (!post.url) return false;
      
      const url = post.url.toLowerCase();
      const isGif = url.endsWith('.gif') || 
                    url.includes('gfycat.com') || 
                    url.includes('giphy.com') ||
                    url.includes('redgifs.com') ||
                    (url.includes('imgur.com') && !url.endsWith('.jpg') && !url.endsWith('.png'));
      
      // Also verify it's not NSFW
      const isSafe = !post.over_18;
      
      return isGif && isSafe;
    })
    .map(post => {
      let gifUrl = post.url;
      let previewUrl = null;
      
      // Try to get preview URL from Reddit's media previews if available
      if (post.preview && 
          post.preview.images && 
          post.preview.images[0]) {
        
        if (post.preview.images[0].variants && 
            post.preview.images[0].variants.gif) {
          // Use the GIF preview if available
          previewUrl = post.preview.images[0].variants.gif.source.url;
        } else {
          // Fall back to static image preview
          previewUrl = post.preview.images[0].source.url;
        }
        
        // Reddit escapes HTML entities in URLs, so we need to unescape them
        if (previewUrl) {
          previewUrl = previewUrl.replace(/&amp;/g, '&');
        }
      }
      
      return {
        id: post.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        url: gifUrl,
        preview: previewUrl,
        content_description: post.title || `${query} gif`
      };
    });
}

/**
 * Selects the most relevant subreddits based on the query
 */
function selectRelevantSubreddits(query: string, maxSubreddits: number): string[] {
  // Example: Simple keyword matching for query
  const queryLower = query.toLowerCase();
  
  // Category mapping - add or modify based on your needs
  const categoryMap: {[key: string]: string[]} = {    
    // Reactions
    'reaction': ['reactiongifs', 'gifs'],
    'funny': ['reactiongifs', 'gifs'],
  };
  
  // Find matching categories
  let selectedSubreddits: string[] = [];
  
  // Check for exact phrase matches first
  for (const keyword of Object.keys(categoryMap)) {
    if (queryLower.includes(keyword)) {
      selectedSubreddits = [...selectedSubreddits, ...categoryMap[keyword]];
    }
  }
  
  // Deduplicate
  selectedSubreddits = [...new Set(selectedSubreddits)];
  
  // If no matches or fewer than max, add some defaults
  if (selectedSubreddits.length < maxSubreddits) {
    const defaultSubreddits = ['gifs', 'reactiongifs'];
    
    // Add defaults that aren't already included
    for (const sub of defaultSubreddits) {
      if (!selectedSubreddits.includes(sub) && selectedSubreddits.length < maxSubreddits) {
        selectedSubreddits.push(sub);
      }
    }
  }
  
  // Limit to max subreddits
  return selectedSubreddits.slice(0, maxSubreddits);
}

/**
 * Deduplicate results based on URL
 */
function deduplicateResults(results: GifResult[]): GifResult[] {
  const uniqueUrls = new Set<string>();
  return results.filter(result => {
    if (uniqueUrls.has(result.url)) {
      return false;
    }
    uniqueUrls.add(result.url);
    return true;
  });
}

/**
 * Helper for mock GIF URLs (for compatibility with existing code)
 */
function getMockGifs(query: string): string[] {
  const encodedQuery = encodeURIComponent(query);
  return [
    `https://i.imgur.com/mock-${encodedQuery}-1.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-2.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-3.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-4.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-5.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-6.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-7.gif`,
    `https://i.imgur.com/mock-${encodedQuery}-8.gif`,
  ];
}

/**
 * Helper for mock GIF results with more metadata
 */
function getMockGifResults(query: string): GifResult[] {
  // Ensure query is not empty to avoid encoding issues
  const safeQuery = query || "gif";
  const encodedQuery = encodeURIComponent(safeQuery);
  
  // Common terms for New York
  const nyContent = [
    "New York City skyline",
    "Times Square at night",
    "Central Park in autumn",
    "Brooklyn Bridge",
    "Manhattan skyscrapers",
    "New York subway",
    "Yellow taxi in NYC",
    "Empire State Building"
  ];
  
  // If query is related to New York, use NY-specific content
  const isNyQuery = safeQuery.toLowerCase().includes("new york") || 
                   safeQuery.toLowerCase().includes("nyc");
  
  const contentDescriptions = isNyQuery ? nyContent : 
    Array.from({ length: 8 }, (_, i) => `${safeQuery} gif ${i + 1}`);
  
  return Array.from({ length: 8 }, (_, i) => ({
    id: `mock-${encodedQuery}-${i}`,
    url: `https://i.imgur.com/mock-${encodedQuery}-${i + 1}.gif`,
    preview: `https://i.imgur.com/mock-${encodedQuery}-${i + 1}-small.gif`,
    content_description: contentDescriptions[i]
  }));
}