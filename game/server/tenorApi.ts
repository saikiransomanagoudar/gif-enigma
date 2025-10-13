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
    gif?: TenorGifFormat;
    tinygif?: TenorGifFormat;
    mediumgif?: TenorGifFormat;
    nanogif?: TenorGifFormat;
    [key: string]: TenorGifFormat | undefined;
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

export async function searchTenorGifs(
  params: TenorSearchParams,
  context: Context
): Promise<TenorGifResult[]> {
  const { query, limit = 16 } = params;
  const contentfilter = "high";
  const media_filter = "gif,tinygif,mediumgif,nanogif";

  try {
    const cachedResults = await getCachedTenorResults({ query }, context);
    if (cachedResults.success && cachedResults.cached) {
      return cachedResults.results || [];
    }

    const apiKey = await context.settings.get('tenor-api-key');
    

    // Construct the search URL with query parameters, matching the server version
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
    throw new Error('Error searching Tenor GIFs');
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
    return { success: false, error: String(error) };
  }
}
