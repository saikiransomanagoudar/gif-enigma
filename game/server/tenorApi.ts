import { Context } from '@devvit/public-api';

// Define the Tenor API base URL
const TENOR_API_BASE_URL = "https://tenor.googleapis.com/v2";

// Define types for Tenor API responses
export interface TenorGifFormat {
  url: string;
  dims: number[];
  duration: number;
  preview: string;
  size: number;
}

export interface TenorGifResult {
  id: string;
  title: string;
  media_formats: {
    gif: TenorGifFormat;
    tinygif: TenorGifFormat;
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

interface TenorSearchResponse {
  results: TenorGifResult[];
  next: string;
}

export interface TenorSearchParams {
  query: string;
  limit?: number;
  pos?: string;
  contentfilter?: string;
  media_filter?: string;
  locale?: string;
}

/**
 * Search for GIFs using the Tenor API.
 * This function first checks for cached results. If none are available,
 * it makes a request to the Tenor API and then caches the results.
 */
export async function searchTenorGifs(
  params: TenorSearchParams,
  context: Context
): Promise<TenorGifResult[]> {
  const { query, limit = 8, contentfilter = "off", media_filter = "minimal" } = params;

  try {
    // Attempt to retrieve cached results first
    const cachedResults = await getCachedTenorResults({ query }, context);
    if (cachedResults.success && cachedResults.cached) {
      return cachedResults.results || [];
    }

    // Retrieve the API key from app settings
    const apiKey = await context.settings.get('tenor-api-key');
    if (!apiKey) {
      console.error('Tenor API key not configured. Please set it in the app settings.');
      return generateMockTenorResults(query);
    }

    // Construct the search URL with query parameters
    const searchUrl = `${TENOR_API_BASE_URL}/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${limit}&contentfilter=${contentfilter}&media_filter=${media_filter}`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Tenor API response not ok: ${response.status}`);
    }

    const data: TenorSearchResponse = await response.json();
    if (data && data.results && Array.isArray(data.results)) {
      // Cache the results for future use
      await cacheTenorResults({ query, results: data.results }, context);

      // Ensure a content description is set for each GIF
      const results = data.results.map(gif => ({
        ...gif,
        content_description: gif.content_description || gif.title || `${query} gif`
      }));

      return results;
    }
    return [];
  } catch (error) {
    console.error('Error searching Tenor GIFs:', error);
    return generateMockTenorResults(query);
  }
}

/**
 * Cache the Tenor search results for 24 hours.
 */
export async function cacheTenorResults(
  params: { query: string; results: TenorGifResult[] },
  context: Context
): Promise<{ success: boolean; error?: string }> {
  try {
    const { query, results } = params;
    if (!query || !results || !Array.isArray(results)) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Set cache expiration to 24 hours from now
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + 86400); // 24 hours

    await context.redis.set(`tenorSearch:${query.toLowerCase()}`, JSON.stringify(results), {
      expiration: expirationDate,
    });

    return { success: true };
  } catch (error) {
    console.error('Error caching Tenor results:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve cached Tenor search results.
 */
export async function getCachedTenorResults(
  params: { query: string },
  context: Context
): Promise<{ success: boolean; cached?: boolean; results?: TenorGifResult[]; error?: string }> {
  try {
    const { query } = params;
    if (!query) {
      return { success: false, error: 'Invalid query' };
    }

    const cachedResults = await context.redis.get(`tenorSearch:${query.toLowerCase()}`);
    if (!cachedResults) {
      return { success: false, cached: false };
    }

    return { 
      success: true, 
      cached: true, 
      results: JSON.parse(cachedResults) as TenorGifResult[]
    };
  } catch (error) {
    console.error('Error getting cached Tenor results:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate mock Tenor GIF results for development/testing.
 */
export function generateMockTenorResults(query: string): TenorGifResult[] {
  const mockResults: TenorGifResult[] = [];
  for (let i = 0; i < 8; i++) {
    mockResults.push({
      id: `tenor-${i}-${Date.now()}`,
      title: `${query} GIF ${i + 1}`,
      media_formats: {
        gif: {
          url: `https://media.tenor.com/mock-gif-${i}.gif`,
          dims: [480, 320],
          duration: 0,
          preview: `https://media.tenor.com/mock-preview-${i}.gif`,
          size: 1024000,
        },
        tinygif: {
          url: `https://media.tenor.com/mock-tinygif-${i}.gif`,
          dims: [220, 150],
          duration: 0,
          preview: `https://media.tenor.com/mock-tinypreview-${i}.gif`,
          size: 256000,
        },
      },
      content_description: `${query} example ${i + 1}`,
      created: Date.now(),
      hasaudio: false,
      url: `https://tenor.com/view/mock-${i}`,
    });
  }
  return mockResults;
}
