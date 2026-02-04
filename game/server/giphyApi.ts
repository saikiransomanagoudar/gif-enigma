import { Context } from '@devvit/public-api';

// Define the GIPHY API base URL
const GIPHY_API_BASE_URL = "https://api.giphy.com/v1/gifs";

// Define types for GIPHY API responses
export interface GiphyGifFormat {
    url: string;
    dims: number[];
    duration: number;
    preview: string;
    size: number;
}

export interface GiphyGifResult {
    id: string;
    title: string;
    media_formats: {
        gif?: GiphyGifFormat;
        tinygif?: GiphyGifFormat;
        mediumgif?: GiphyGifFormat;
        nanogif?: GiphyGifFormat;
        [key: string]: GiphyGifFormat | undefined;
    };
    content_description: string;
    created: number;
    hasaudio: boolean;
    url: string;
}

interface GiphyImageRendition {
    url: string;
    width: string;
    height: string;
    size?: string;
    mp4?: string;
    mp4_size?: string;
    webp?: string;
    webp_size?: string;
}

interface GiphyRawGifResult {
    id: string;
    title: string;
    url: string;
    rating: string;
    import_datetime: string;
    images: {
        original?: GiphyImageRendition;
        fixed_height?: GiphyImageRendition;
        fixed_height_small?: GiphyImageRendition;
        fixed_width?: GiphyImageRendition;
        fixed_width_small?: GiphyImageRendition;
        downsized?: GiphyImageRendition;
        downsized_small?: GiphyImageRendition;
        preview_gif?: GiphyImageRendition;
        [key: string]: GiphyImageRendition | undefined;
    };
    alt_text?: string;
}

interface GiphySearchResponse {
    data: GiphyRawGifResult[];
    pagination: {
        total_count: number;
        count: number;
        offset: number;
    };
    meta: {
        status: number;
        msg: string;
    };
}

export interface GiphySearchParams {
    query: string;
    limit?: number;
    offset?: number;
    rating?: string;
    lang?: string;
}

/**
 * Transform GIPHY raw result to our standard GiphyGifResult format
 */
function transformGiphyResult(raw: GiphyRawGifResult, query: string): GiphyGifResult {
    const images = raw.images || {};

    // Helper to create a GiphyGifFormat from a rendition
    const toFormat = (rendition: GiphyImageRendition | undefined): GiphyGifFormat | undefined => {
        if (!rendition || !rendition.url) return undefined;
        return {
            url: rendition.url,
            dims: [parseInt(rendition.width) || 0, parseInt(rendition.height) || 0],
            duration: 0, // GIPHY doesn't provide duration in the same way
            preview: rendition.url,
            size: parseInt(rendition.size || '0') || 0,
        };
    };

    return {
        id: raw.id,
        title: raw.title || '',
        media_formats: {
            gif: toFormat(images.original),
            tinygif: toFormat(images.fixed_height) || toFormat(images.downsized),
            mediumgif: toFormat(images.original) || toFormat(images.fixed_height),
            nanogif: toFormat(images.preview_gif) || toFormat(images.fixed_width_small),
        },
        content_description: raw.alt_text || raw.title || `${query} gif`,
        created: new Date(raw.import_datetime).getTime() || Date.now(),
        hasaudio: false, // GIPHY GIFs don't have audio
        url: raw.url,
    };
}

export async function searchGiphyGifs(
    params: GiphySearchParams,
    context: Context
): Promise<GiphyGifResult[]> {
    const { query, limit = 16 } = params;
    // Use 'g' rating for family-friendly content
    const rating = 'g';

    try {
        const cachedResults = await getCachedGiphyResults({ query }, context);
        if (cachedResults.success && cachedResults.cached) {
            return cachedResults.results || [];
        }

        const apiKey = await context.settings.get('giphy-api-key');

        // Construct the search URL with query parameters
        const searchUrl = `${GIPHY_API_BASE_URL}/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&limit=${limit}&rating=${rating}`;
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error(`GIPHY API response not ok: ${response.status}`);
        }

        const data: GiphySearchResponse = await response.json();
        if (data && data.data && Array.isArray(data.data)) {
            // Transform and cache the results
            const results = data.data.map(gif => transformGiphyResult(gif, query));
            await cacheGiphyResults({ query, results }, context);

            return results;
        }
        return [];
    } catch (error) {
        throw new Error('Error searching GIPHY GIFs');
    }
}

/**
 * Cache the GIPHY search results for 24 hours.
 */
export async function cacheGiphyResults(
    params: { query: string; results: GiphyGifResult[] },
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

        await context.redis.set(`giphySearch:${query.toLowerCase()}`, JSON.stringify(results), {
            expiration: expirationDate,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Retrieve cached GIPHY search results.
 */
export async function getCachedGiphyResults(
    params: { query: string },
    context: Context
): Promise<{ success: boolean; cached?: boolean; results?: GiphyGifResult[]; error?: string }> {
    try {
        const { query } = params;
        if (!query) {
            return { success: false, error: 'Invalid query' };
        }

        const cachedResults = await context.redis.get(`giphySearch:${query.toLowerCase()}`);
        if (!cachedResults) {
            return { success: false, cached: false };
        }

        return {
            success: true,
            cached: true,
            results: JSON.parse(cachedResults) as GiphyGifResult[]
        };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
