import { Context } from '@devvit/public-api';

interface GiphyGifFormat {
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
        tinygif: GiphyGifFormat;
        mp4?: GiphyGifFormat;
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

const GIPHY_CACHE_PREFIX = 'giphy_search:';
const CACHE_TTL = 60 * 60 * 24; // 1 day

const GIF_CACHE_PREFIX = 'giphy_gif:';

/**
 * Transform GIPHY raw result to our standard GiphyGifResult format
 */
function transformGiphyToInternal(raw: GiphyRawGifResult, query: string): GiphyGifResult {
    const images = raw.images || {};

    // Helper to create a GiphyGifFormat from a rendition
    const toFormat = (rendition: GiphyImageRendition | undefined): GiphyGifFormat => {
        if (!rendition || !rendition.url) {
            return { url: '', dims: [0, 0], duration: 0, preview: '', size: 0 };
        }
        return {
            url: rendition.url,
            dims: [parseInt(rendition.width) || 0, parseInt(rendition.height) || 0],
            duration: 0,
            preview: rendition.url,
            size: parseInt(rendition.size || '0') || 0,
        };
    };

    // Use fixed_height as tinygif equivalent (better quality, ~200px height)
    const tinygifSource = images.fixed_height || images.downsized || images.fixed_height_small;

    return {
        id: raw.id,
        title: raw.title || '',
        media_formats: {
            gif: toFormat(images.original),
            tinygif: toFormat(tinygifSource),
            mp4: images.original?.mp4 ? {
                url: images.original.mp4,
                dims: [parseInt(images.original.width) || 0, parseInt(images.original.height) || 0],
                duration: 0,
                preview: images.original.mp4,
                size: parseInt(images.original.mp4_size || '0') || 0,
            } : undefined,
        },
        content_description: raw.alt_text || raw.title || `${query} gif`,
        created: new Date(raw.import_datetime).getTime() || Date.now(),
        hasaudio: false,
        url: raw.url,
    };
}

async function cacheGiphyGif(context: Context, giphyGif: GiphyGifResult): Promise<GiphyGifResult> {
    const cacheKey = `${GIF_CACHE_PREFIX}${giphyGif.id}`;

    try {
        const cachedFormats = await context.redis.get(cacheKey);
        if (cachedFormats) {
            return JSON.parse(cachedFormats);
        }

        const uploadedFormats: Record<string, GiphyGifFormat> = {};
        const isRedditCdn = (url?: string) => !!url && url.startsWith('https://i.redd.it/');

        const fastUpload = async (url: string): Promise<string> => {
            const uploadPromise = context.media.upload({ url, type: 'gif' });
            const result = await Promise.race([
                uploadPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('upload-timeout')), 2500))
            ]);
            // @ts-expect-error Result is from uploadPromise
            return (result.mediaUrl as string) || url;
        };

        const tinygifUrl = giphyGif.media_formats.tinygif?.url;

        if (!tinygifUrl) {
            return {
                ...giphyGif,
                url: '',
                media_formats: {
                    ...giphyGif.media_formats,
                    tinygif: { ...giphyGif.media_formats.tinygif, url: '' },
                },
            };
        }

        try {
            const mediaUrl = await fastUpload(tinygifUrl);

            if (isRedditCdn(mediaUrl)) {
                uploadedFormats.tinygif = { ...giphyGif.media_formats.tinygif, url: mediaUrl };
            }
        } catch {
            // Upload failed, continue without uploaded format
        }

        if (giphyGif.media_formats.gif?.url) {
            uploadedFormats.gif = giphyGif.media_formats.gif;
        }

        const preferredUrl = uploadedFormats.tinygif?.url || '';

        const cachedResult = {
            ...giphyGif,
            media_formats: {
                ...giphyGif.media_formats,
                ...uploadedFormats
            },
            url: preferredUrl
        };

        if (!isRedditCdn(cachedResult.url)) {
            return {
                ...cachedResult,
                url: '',
                media_formats: {
                    ...cachedResult.media_formats,
                    tinygif: cachedResult.media_formats.tinygif ? { ...cachedResult.media_formats.tinygif, url: '' } : cachedResult.media_formats.tinygif,
                },
            } as GiphyGifResult;
        }

        try {
            await context.redis.set(cacheKey, JSON.stringify(cachedResult));
            await context.redis.expire(cacheKey, CACHE_TTL);
        } catch {
            // Redis cache failed, but return valid result anyway
        }

        return cachedResult;

    } catch {
        return giphyGif;
    }
}

export async function searchGiphyGifs(
    context: Context,
    query: string,
    limit: number = 4
): Promise<GiphyGifResult[]> {
    if (!query || query.trim() === '') {
        return [];
    }

    try {
        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
        const cachedData = await context.redis.get(cacheKey);

        if (cachedData) {
            const results = JSON.parse(cachedData);
            if (results.length >= limit) {
                return results;
            }
        }
    } catch {
        // Cache check failed, continue with API fetch
    }

    const apiKey = await context.settings.get('giphy-api-key');

    if (!apiKey) {
        return [];
    }

    // Smart strategy: fetch in batches and process until we have enough
    const desiredCount = Math.max(1, limit);
    const collected: GiphyGifResult[] = [];
    const seenIds = new Set<string>();
    const seenBaseUrls = new Set<string>(); // Track base URLs to detect same GIF in different sizes

    // Pre-computed metadata cache for collected GIFs to avoid reprocessing
    interface GifMetadata {
        aspectRatio: number;
        duration: number;
        words: Set<string>;
        baseUrl: string;
    }
    const collectedMetadata = new Map<string, GifMetadata>();
    const commonWords = new Set(['gif', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'from']);

    // Helper: Extract base URL from GIPHY URL (removes size/format variations)
    const getBaseGiphyUrl = (gif: GiphyGifResult): string => {
        // Extract the media ID from various URL formats
        // e.g., https://media1.giphy.com/media/ABC123/100.gif -> ABC123
        // or from gif.id directly
        const id = gif.id || '';
        if (id) return id;
        
        // Fallback: try to extract from URL
        const url = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || '';
        const match = url.match(/\/media\/([^/]+)\//);
        return match ? match[1] : url;
    };

    // Helper: Extract metadata from GIF once
    const extractMetadata = (gif: GiphyGifResult): GifMetadata | null => {
        const format = gif.media_formats?.gif || gif.media_formats?.tinygif;
        if (!format || !format.dims) return null;

        const width = format.dims[0] || 0;
        const height = format.dims[1] || 0;
        const aspectRatio = width > 0 && height > 0 ? width / height : 0;
        const duration = Math.round((format.duration || 0) * 10) / 10;
        const desc = (gif.content_description || gif.title || '').toLowerCase().trim();
        const words = new Set(
            desc.split(/\s+/).filter(w => w.length > 2 && !commonWords.has(w))
        );
        const baseUrl = getBaseGiphyUrl(gif);

        return { aspectRatio, duration, words, baseUrl };
    };

    const isSimilarToCollected = (newGif: GiphyGifResult): boolean => {
        const newMeta = extractMetadata(newGif);
        if (!newMeta) return false;
        
        // Check if we've already seen this exact GIF (by base URL/ID)
        if (seenBaseUrls.has(newMeta.baseUrl)) {
            return true;
        }
        
        // More aggressive duplicate detection
        for (const [, existingMeta] of collectedMetadata) {
            // 1. Same aspect ratio (stricter threshold for exact matches)
            const aspectDiff = Math.abs(existingMeta.aspectRatio - newMeta.aspectRatio);
            if (aspectDiff < 0.05) { // Very similar aspect ratio
                // 2. Check word overlap in description (lowered threshold from 0.6 to 0.5)
                const commonWordCount = [...newMeta.words].filter(w => existingMeta.words.has(w)).length;
                const totalWords = Math.max(newMeta.words.size, existingMeta.words.size);
                if (totalWords > 0 && commonWordCount / totalWords > 0.5) {
                    return true;
                }
                
                // 3. If descriptions are very similar AND aspect ratios match closely, it's likely the same GIF
                if (totalWords > 0 && commonWordCount / totalWords > 0.4 && aspectDiff < 0.02) {
                    return true;
                }
            }
        }
        
        return false;
    };

    let offset = 0;
    let page = 0;
    const MAX_PAGES = 10;

    while (collected.length < desiredCount && page < MAX_PAGES) {
        const fetchLimit = 50;
        const apiUrl = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&limit=${fetchLimit}&offset=${offset}&rating=g`;

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`GIPHY API returned status ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.data || data.data.length === 0) {
                break;
            }

            const results = data.data;

            let consecutiveErrors = 0;
            const MAX_CONSECUTIVE_ERRORS = 3;

            for (let i = 0; i < results.length && collected.length < desiredCount; i++) {
                const result = results[i] as GiphyRawGifResult;
                
                // Skip if we've already seen this GIF
                if (seenIds.has(result.id)) {
                    continue;
                }

                const transformed = transformGiphyToInternal(result, query);
                let cachedGif: GiphyGifResult;

                try {
                    cachedGif = await cacheGiphyGif(context, transformed);
                    if (cachedGif.url && cachedGif.url.startsWith('https://i.redd.it/')) {
                        consecutiveErrors = 0;
                    }
                } catch {
                    consecutiveErrors++;
                    cachedGif = transformed;
                    
                    const backoffMs = Math.min(200 * consecutiveErrors, 800);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        break;
                    }
                }

                const hasValidUrl = typeof cachedGif?.url === 'string' && cachedGif.url.startsWith('https://i.redd.it/');

                if (hasValidUrl && !seenIds.has(cachedGif.id)) {
                    consecutiveErrors = 0;
                    
                    if (isSimilarToCollected(cachedGif)) {
                        continue;
                    }

                    collected.push(cachedGif);
                    seenIds.add(cachedGif.id);
                    const metadata = extractMetadata(cachedGif);
                    if (metadata) {
                        collectedMetadata.set(cachedGif.id, metadata);
                        seenBaseUrls.add(metadata.baseUrl);
                    }
                    
                    if (collected.length < desiredCount) {
                        await new Promise(resolve => setTimeout(resolve, 400));
                    }
                } else {
                    consecutiveErrors++;
                    
                    const backoffMs = Math.min(500 * consecutiveErrors, 1500);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        break;
                    }
                }
            }

            if (collected.length >= desiredCount) break;

            offset += fetchLimit;
            page += 1;

            if (data.pagination && offset >= data.pagination.total_count) {
                break;
            }
        } catch {
            break;
        }
    }

    const usableResults = collected.slice(0, desiredCount);

    if (usableResults.length > 0) {
        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
        await context.redis.set(cacheKey, JSON.stringify(usableResults));
        await context.redis.expire(cacheKey, CACHE_TTL);
    }

    return usableResults;
}

/**
 * Search GIPHY GIFs for multiple queries in parallel and cache all results in Redis.
 * Calls onResult callback as each query completes for incremental updates.
 */
export async function searchMultipleGiphyGifs(
    context: Context,
    queries: string[],
    limit: number = 4,
    onResult?: (query: string, results: GiphyGifResult[]) => void
): Promise<{ [query: string]: GiphyGifResult[] }> {
    if (!queries || queries.length === 0) {
        return {};
    }

    const uniqueQueries = Array.from(new Set(queries.filter(q => q && q.trim() !== '')));

    if (uniqueQueries.length === 0) {
        return {};
    }

    const resultMap: { [query: string]: GiphyGifResult[] } = {};

    try {
        const searchWithTimeout = async () => {
            const timeoutPromise = new Promise<{ [query: string]: GiphyGifResult[] }>((_, reject) => {
                setTimeout(() => reject(new Error('Batch search timeout')), 30000);
            });

            const searchPromise = (async () => {
                const uncachedQueries: string[] = [];

                for (const query of uniqueQueries) {
                    try {
                        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
                        const cachedData = await context.redis.get(cacheKey);
                        if (cachedData) {
                            const cachedResults = JSON.parse(cachedData);
                            if (cachedResults.length >= limit) {
                                resultMap[query] = cachedResults;
                                if (onResult) onResult(query, cachedResults);
                            } else {
                                uncachedQueries.push(query);
                            }
                        } else {
                            uncachedQueries.push(query);
                        }
                    } catch {
                        uncachedQueries.push(query);
                    }
                }

                const fetchPromises = uncachedQueries.map(async (query, index) => {
                    await new Promise(resolve => setTimeout(resolve, index * 150));
                    
                    try {
                        const results = await searchGiphyGifs(context, query, limit);
                        resultMap[query] = results;
                        if (onResult) onResult(query, results);
                        return { query, results };
                    } catch {
                        resultMap[query] = [];
                        if (onResult) onResult(query, []);
                        return { query, results: [] as GiphyGifResult[] };
                    }
                });

                await Promise.all(fetchPromises);

                return resultMap;
            })();

            return Promise.race([searchPromise, timeoutPromise]);
        };

        return await searchWithTimeout();
    } catch {
        for (const query of uniqueQueries) {
            if (!resultMap[query]) {
                try {
                    const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
                    const cachedData = await context.redis.get(cacheKey);
                    if (cachedData) {
                        resultMap[query] = JSON.parse(cachedData);
                    } else {
                        resultMap[query] = [];
                    }
                } catch {
                    resultMap[query] = [];
                }
            }
        }
        return resultMap;
    }
}
