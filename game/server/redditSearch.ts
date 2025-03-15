import { Context } from '@devvit/public-api';

interface RedditSearchParams {
  query: string;
  subreddits?: string[];
  limit?: number;
  sort?: string;
}

export interface GifResult {
  id: string;
  url: string;
  preview?: string;
  thumbnail?: string;
  title?: string;
  author?: string;
  subreddit: string;
  created_utc?: number;
  permalink?: string;
  content_description: string;
}

// List of popular GIF subreddits to search across
export const GIF_SUBREDDITS = [
  'gifs',           // General GIFs
  'reactiongifs',   // Reaction GIFs
  'HighQualityGifs', // Premium quality GIFs
  'perfectloops',   // Seamlessly looping GIFs
  'wholesomegifs',  // Uplifting GIFs
  'oddlysatisfying', // Satisfying content
  'BeAmazed',       // Amazing content
  'educationalgifs' // Educational GIFs
];

/**
 * Server-side function to search GIFs using the Devvit Reddit API
 */
export async function redditSearch(params: RedditSearchParams, context: Context): Promise<string[]> {
  try {
    const results = await redditSearchEnhanced(params, context);
    
    // Extract just the URLs
    return results.map(gif => gif.url);
  } catch (error) {
    console.error('Error searching Reddit GIFs:', error);
    return []; // Return empty array on error
  }
}

/**
 * Enhanced version that returns more GIF metadata
 */
export async function redditSearchEnhanced(params: RedditSearchParams, context: Context): Promise<GifResult[]> {
  try {
    const { query, subreddits = GIF_SUBREDDITS, limit = 8 } = params;
    
    // Select the most relevant subreddits based on the query
    const subredditsToSearch = selectRelevantSubreddits(query, subreddits, 5);
    let allResults: GifResult[] = [];
    
    // For each subreddit, fetch posts using multiple methods
    const fetchPromises = subredditsToSearch.map(async (subreddit) => {
      try {
        // Get combined results from multiple endpoints
        const results = await fetchSubredditGifs(subreddit, query, Math.ceil(limit / 2), context);
        return results;
      } catch (error) {
        console.warn(`Error fetching from r/${subreddit}:`, error);
        return [] as GifResult[];
      }
    });
    
    // Wait for all requests to complete
    const subredditResults = await Promise.all(fetchPromises);
    
    // Combine all results
    for (const results of subredditResults) {
      allResults = [...allResults, ...results];
    }
    
    // Deduplicate results
    const uniqueResults = deduplicateResults(allResults);
    
    // Return the requested number of results
    return uniqueResults.slice(0, limit);
  } catch (error) {
    console.error('Error searching Reddit GIFs:', error);
    return []; // Return empty array on error
  }
}

/**
 * Fetch GIFs from a subreddit using multiple Reddit API methods
 */
async function fetchSubredditGifs(
  subreddit: string,
  query: string,
  limit: number,
  context: Context
): Promise<GifResult[]> {
  try {
    let allPosts: any[] = [];
    
    // Get hot posts
    try {
      const hotPosts = await context.reddit.getHotPosts({
        subredditName: subreddit,
        limit: limit,
        pageSize: 50
      });
      
      const hotPostsArray = await hotPosts.all();
      allPosts = [...allPosts, ...hotPostsArray];
    } catch (error) {
      console.warn(`Error getting hot posts from r/${subreddit}:`, error);
    }
    
    // If we need more, get new posts
    if (allPosts.length < limit) {
      try {
        const newPosts = await context.reddit.getNewPosts({
          subredditName: subreddit,
          limit: limit,
          pageSize: 50
        });
        
        const newPostsArray = await newPosts.all();
        allPosts = [...allPosts, ...newPostsArray];
      } catch (error) {
        console.warn(`Error getting new posts from r/${subreddit}:`, error);
      }
    }
    
    // If we still need more, get top posts
    if (allPosts.length < limit) {
      try {
        const topPosts = await context.reddit.getTopPosts({
          subredditName: subreddit,
          limit: limit,
          timeframe: 'month',
          pageSize: 50
        });
        
        const topPostsArray = await topPosts.all();
        allPosts = [...allPosts, ...topPostsArray];
      } catch (error) {
        console.warn(`Error getting top posts from r/${subreddit}:`, error);
      }
    }
    
    // Filter for GIFs
    const gifPosts = filterPostsForGifs(allPosts);
    
    // Filter for query relevance
    let filteredPosts = gifPosts;
    if (query) {
      const queryFiltered = filterByQuery(gifPosts, query);
      // Only use query filtering if it doesn't reduce results too much
      if (queryFiltered.length >= Math.min(3, gifPosts.length / 2)) {
        filteredPosts = queryFiltered;
      }
    }
    
    // Convert to GifResult format
    return processSearchResults(filteredPosts, query, subreddit);
  } catch (error) {
    console.error(`Error fetching from r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Filter posts to keep only GIF content
 */
function filterPostsForGifs(posts: any[]): any[] {
  if (!posts || !Array.isArray(posts)) return [];
  
  return posts.filter(post => {
    if (!post || !post.url) return false;
    
    const url = post.url.toLowerCase();
    const isGif = url.endsWith('.gif') || 
                  url.includes('gfycat.com') || 
                  url.includes('giphy.com') ||
                  url.includes('redgifs.com') ||
                  (url.includes('imgur.com') && !url.endsWith('.jpg') && !url.endsWith('.png'));
    
    // Also verify it's not NSFW
    const isSafe = post.over_18 !== true;
    
    return isGif && isSafe;
  });
}

/**
 * Filter posts by query terms
 */
function filterByQuery(posts: any[], query: string): any[] {
  if (!query || !posts || !Array.isArray(posts)) return posts;
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  if (queryWords.length === 0) return posts;
  
  return posts.filter(post => {
    if (!post.title) return true;
    
    const title = post.title.toLowerCase();
    return queryWords.some(word => title.includes(word));
  });
}

/**
 * Process posts into GifResult format
 */
function processSearchResults(
  posts: any[],
  query: string,
  subreddit: string
): GifResult[] {
  if (!posts || !Array.isArray(posts)) return [];
  
  return posts.map(post => {
    let gifUrl = post.url || '';
    let previewUrl = null;
    
    // Try to get preview URL if available
    if (post.preview && 
        post.preview.images && 
        post.preview.images[0]) {
      
      // Check for GIF variant
      if (post.preview.images[0].variants && 
          post.preview.images[0].variants.gif &&
          post.preview.images[0].variants.gif.source) {
        previewUrl = post.preview.images[0].variants.gif.source.url;
      } 
      // Fall back to static preview
      else if (post.preview.images[0].source) {
        previewUrl = post.preview.images[0].source.url;
      }
      
      // Reddit escapes HTML entities in URLs
      if (previewUrl) {
        previewUrl = previewUrl.replace(/&amp;/g, '&');
      }
    }
    
    return {
      id: post.id || `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url: gifUrl,
      preview: previewUrl,
      thumbnail: post.thumbnail,
      title: post.title,
      author: post.author,
      subreddit: post.subreddit || subreddit,
      created_utc: post.created_utc,
      permalink: post.permalink ? `https://reddit.com${post.permalink}` : undefined,
      content_description: post.title || `${query} gif`
    };
  });
}

/**
 * Select relevant subreddits based on query
 */
function selectRelevantSubreddits(
  query: string,
  availableSubreddits: string[],
  maxSubreddits: number
): string[] {
  if (!availableSubreddits || !Array.isArray(availableSubreddits) || availableSubreddits.length === 0) {
    return GIF_SUBREDDITS.slice(0, maxSubreddits);
  }
  
  // Category mapping for search terms
  const categoryMap: {[key: string]: string[]} = {    
    // Reactions
    'reaction': ['reactiongifs', 'gifs'],
    'funny': ['reactiongifs', 'gifs'],
    'laugh': ['reactiongifs', 'gifs'],
    'smile': ['reactiongifs', 'wholesomegifs'],
    'happy': ['wholesomegifs', 'gifs'],
    'sad': ['reactiongifs', 'gifs'],
    'angry': ['reactiongifs', 'gifs'],
    'cool': ['HighQualityGifs', 'gifs'],
    'wow': ['reactiongifs', 'gifs'],
    'amazing': ['BeAmazed', 'HighQualityGifs'],
    'loop': ['perfectloops', 'gifs'],
    'perfect': ['perfectloops', 'oddlysatisfying'],
    'wholesome': ['wholesomegifs', 'gifs'],
    'cute': ['wholesomegifs', 'gifs'],
    'learn': ['educationalgifs', 'gifs'],
    'education': ['educationalgifs', 'gifs'],
    'science': ['educationalgifs', 'gifs'],
  };
  
  // Find matching categories based on query
  let selectedSubreddits: string[] = [];
  
  if (query) {
    const queryLower = query.toLowerCase();
    for (const keyword of Object.keys(categoryMap)) {
      if (queryLower.includes(keyword)) {
        selectedSubreddits.push(...categoryMap[keyword]);
      }
    }
  }
  
  // Filter to only available subreddits and deduplicate
  selectedSubreddits = [...new Set(
    selectedSubreddits.filter(sub => availableSubreddits.includes(sub))
  )];
  
  // If we don't have enough, add more from available subreddits
  if (selectedSubreddits.length < maxSubreddits) {
    for (const sub of availableSubreddits) {
      if (!selectedSubreddits.includes(sub) && selectedSubreddits.length < maxSubreddits) {
        selectedSubreddits.push(sub);
      }
    }
  }
  
  return selectedSubreddits.slice(0, maxSubreddits);
}

/**
 * Deduplicate results based on URL
 */
function deduplicateResults(results: GifResult[]): GifResult[] {
  if (!results || !Array.isArray(results)) return [];
  
  const uniqueUrls = new Set<string>();
  return results.filter(result => {
    if (!result || !result.url || uniqueUrls.has(result.url)) {
      return false;
    }
    uniqueUrls.add(result.url);
    return true;
  });
}