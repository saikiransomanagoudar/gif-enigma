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

    // Use fixed_height_small as tinygif equivalent (smallest animated version)
    const tinygifSource = images.fixed_height_small || images.preview_gif || images.fixed_width_small;

    console.log(`[GIPHY DEBUG] Transforming GIF ${raw.id}: tinygif source URL = ${tinygifSource?.url || 'NONE'}`);

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
    console.log(`[GIPHY DEBUG] cacheGiphyGif called for ID: ${giphyGif.id}`);

    try {
        // 1. Check Redis cache for ALL formats
        const cachedFormats = await context.redis.get(cacheKey);
        if (cachedFormats) {
            console.log(`[GIPHY DEBUG] Found cached GIF for ID: ${giphyGif.id}`);
            return JSON.parse(cachedFormats);
        }

        // 2. Upload and cache only essential formats first (tinygif) for speed
        const uploadedFormats: Record<string, GiphyGifFormat> = {};

        // Helper: quick utility checks
        const isRedditCdn = (url?: string) => !!url && url.startsWith('https://i.redd.it/');

        // Helper: fast upload with reduced timeout to fail faster on rate limits
        const fastUpload = async (url: string): Promise<string> => {
            console.log(`[GIPHY DEBUG] Attempting to upload GIF to Reddit CDN: ${url}`);
            try {
                const uploadPromise = context.media.upload({ url, type: 'gif' });
                const result = await Promise.race([
                    uploadPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('upload-timeout')), 2500))
                ]);
                // @ts-expect-error Result is from uploadPromise
                const mediaUrl: string = (result.mediaUrl as string) || url;
                console.log(`[GIPHY DEBUG] Upload result: ${mediaUrl}`);
                return mediaUrl;
            } catch (err) {
                console.log(`[GIPHY DEBUG] Upload failed: ${err}`);
                throw err;
            }
        };

        // Get the tinygif URL to upload
        const tinygifUrl = giphyGif.media_formats.tinygif?.url;
        console.log(`[GIPHY DEBUG] tinygif URL to upload: ${tinygifUrl}`);

        if (!tinygifUrl) {
            console.log(`[GIPHY DEBUG] No tinygif URL available for GIF ${giphyGif.id}, skipping upload`);
            return {
                ...giphyGif,
                url: '',
                media_formats: {
                    ...giphyGif.media_formats,
                    tinygif: { ...giphyGif.media_formats.tinygif, url: '' },
                },
            };
        }

        // Upload tinygif format
        try {
            const mediaUrl = await fastUpload(tinygifUrl);
            console.log(`[GIPHY DEBUG] Uploaded mediaUrl: ${mediaUrl}, isRedditCdn: ${isRedditCdn(mediaUrl)}`);

            if (isRedditCdn(mediaUrl)) {
                // Trust the upload result - if media.upload() returns a Reddit CDN URL, it's valid
                // Don't do additional verification fetch as it causes rate limiting issues
                uploadedFormats.tinygif = { ...giphyGif.media_formats.tinygif, url: mediaUrl };
                console.log(`[GIPHY DEBUG] Reddit CDN URL accepted from upload`);
            }
        } catch (error) {
            console.log(`[GIPHY DEBUG] Upload failed for GIF ${giphyGif.id}: ${error}`);
        }

        // Keep gif format with original URL as fallback (not uploaded to avoid slowdown)
        if (giphyGif.media_formats.gif?.url) {
            uploadedFormats.gif = giphyGif.media_formats.gif;
        }

        // 3. Create final cached result (use uploaded tinygif) - MUST be Reddit CDN
        const preferredUrl = uploadedFormats.tinygif?.url || '';
        console.log(`[GIPHY DEBUG] Final preferredUrl for GIF ${giphyGif.id}: ${preferredUrl}`);

        const cachedResult = {
            ...giphyGif,
            media_formats: {
                ...giphyGif.media_formats,
                ...uploadedFormats
            },
            url: preferredUrl
        };

        // ONLY accept Reddit CDN URLs - if upload failed, return empty to skip this GIF
        if (!isRedditCdn(cachedResult.url)) {
            console.log(`[GIPHY DEBUG] GIF ${giphyGif.id} rejected - not a Reddit CDN URL`);
            return {
                ...cachedResult,
                url: '',
                media_formats: {
                    ...cachedResult.media_formats,
                    tinygif: cachedResult.media_formats.tinygif ? { ...cachedResult.media_formats.tinygif, url: '' } : cachedResult.media_formats.tinygif,
                },
            } as GiphyGifResult;
        }

        // 4. Store ALL formats in Redis (non-blocking - don't fail if cache fails)
        console.log(`[GIPHY DEBUG] Caching GIF ${giphyGif.id} with Reddit CDN URL`);
        try {
            await context.redis.set(cacheKey, JSON.stringify(cachedResult));
            await context.redis.expire(cacheKey, CACHE_TTL);
        } catch (cacheErr) {
            console.log(`[GIPHY DEBUG] Redis cache failed for ${giphyGif.id}, but returning valid result: ${cacheErr}`);
        }

        return cachedResult;

    } catch (error) {
        console.log(`[GIPHY DEBUG] cacheGiphyGif error for ${giphyGif.id}: ${error}`);
        return giphyGif;
    }
}

export async function searchGiphyGifs(
    context: Context,
    query: string,
    limit: number = 4
): Promise<GiphyGifResult[]> {
    console.log(`[GIPHY DEBUG] searchGiphyGifs called with query: "${query}", limit: ${limit}`);

    if (!query || query.trim() === '') {
        console.log(`[GIPHY DEBUG] Empty query, returning empty array`);
        return [];
    }

    try {
        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
        const cachedData = await context.redis.get(cacheKey);

        if (cachedData) {
            const results = JSON.parse(cachedData);
            console.log(`[GIPHY DEBUG] Found ${results.length} cached results for query: "${query}"`);
            if (results.length >= limit) {
                return results;
            }
        }
    } catch (cacheError) {
        console.log(`[GIPHY DEBUG] Cache check error: ${cacheError}`);
    }

    const apiKey = await context.settings.get('giphy-api-key');
    console.log(`[GIPHY DEBUG] API key retrieved: ${apiKey ? 'YES (length: ' + String(apiKey).length + ')' : 'NO/EMPTY'}`);

    if (!apiKey) {
        console.log(`[GIPHY DEBUG] ERROR: No GIPHY API key configured!`);
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
        
        // Check for similar content description (catches same GIF with different IDs)
        for (const [, existingMeta] of collectedMetadata) {
            // Same aspect ratio AND significant word overlap = likely duplicate
            if (Math.abs(existingMeta.aspectRatio - newMeta.aspectRatio) < 0.1) {
                const commonWordCount = [...newMeta.words].filter(w => existingMeta.words.has(w)).length;
                const totalWords = Math.max(newMeta.words.size, existingMeta.words.size);
                if (totalWords > 0 && commonWordCount / totalWords > 0.6) {
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
        // GIPHY API URL - using 'g' rating for family-friendly content
        const apiUrl = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&limit=${fetchLimit}&offset=${offset}&rating=g`;

        console.log(`[GIPHY DEBUG] Fetching page ${page + 1}, offset ${offset}, URL: ${apiUrl.replace(String(apiKey), 'API_KEY_HIDDEN')}`);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            console.log(`[GIPHY DEBUG] API response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`[GIPHY DEBUG] API error response: ${errorText}`);
                throw new Error(`GIPHY API returned status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`[GIPHY DEBUG] API response - data array length: ${data?.data?.length || 0}, pagination: ${JSON.stringify(data?.pagination || {})}`);

            if (!data || !data.data || data.data.length === 0) {
                console.log(`[GIPHY DEBUG] No more results from API`);
                break;
            }

            const results = data.data;
            console.log(`[GIPHY DEBUG] Processing ${results.length} raw results (sequential to avoid rate limits)`);

            let consecutiveErrors = 0;
            const MAX_CONSECUTIVE_ERRORS = 3; // Stop trying after 3 consecutive upload failures

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
                    // Reset error counter on success
                    if (cachedGif.url && cachedGif.url.startsWith('https://i.redd.it/')) {
                        consecutiveErrors = 0;
                    }
                } catch (error) {
                    console.log(`[GIPHY DEBUG] Error caching GIF ${result.id}: ${error}`);
                    consecutiveErrors++;
                    cachedGif = transformed;
                    
                    // Brief wait before next attempt
                    const backoffMs = Math.min(200 * consecutiveErrors, 800);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    
                    // Check if we should stop due to rate limiting
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        console.log(`[GIPHY DEBUG] Stopping after ${consecutiveErrors} consecutive errors (likely rate limited)`);
                        break;
                    }
                }

                const hasValidUrl = typeof cachedGif?.url === 'string' && cachedGif.url.startsWith('https://i.redd.it/');
                console.log(`[GIPHY DEBUG] GIF ${cachedGif.id}: url="${cachedGif.url}", hasValidUrl=${hasValidUrl}`);

                if (hasValidUrl && !seenIds.has(cachedGif.id)) {
                    // Successfully got a valid URL - reset error counter even if skipped for similarity
                    consecutiveErrors = 0;
                    
                    if (isSimilarToCollected(cachedGif)) {
                        console.log(`[GIPHY DEBUG] GIF ${cachedGif.id} skipped - too similar to existing`);
                        continue;
                    }

                    collected.push(cachedGif);
                    seenIds.add(cachedGif.id);
                    const metadata = extractMetadata(cachedGif);
                    if (metadata) {
                        collectedMetadata.set(cachedGif.id, metadata);
                        seenBaseUrls.add(metadata.baseUrl); // Track base URL to prevent duplicates
                    }

                    console.log(`[GIPHY DEBUG] GIF ${cachedGif.id} added to collection (total: ${collected.length})`);
                    
                    // Delay between uploads - balanced for speed vs rate limits
                    if (collected.length < desiredCount) {
                        await new Promise(resolve => setTimeout(resolve, 400));
                    }
                } else {
                    // Track failed uploads (no valid URL)
                    consecutiveErrors++;
                    
                    // Backoff delay on failure
                    const backoffMs = Math.min(500 * consecutiveErrors, 1500);
                    console.log(`[GIPHY DEBUG] Upload failed, waiting ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        console.log(`[GIPHY DEBUG] Stopping after ${consecutiveErrors} consecutive failures (likely rate limited)`);
                        break;
                    }
                }
            }

            console.log(`[GIPHY DEBUG] Page complete: collected ${collected.length} GIFs so far`);

            if (collected.length >= desiredCount) break;

            offset += fetchLimit;
            page += 1;

            if (data.pagination && offset >= data.pagination.total_count) {
                console.log(`[GIPHY DEBUG] Reached end of results (offset ${offset} >= total ${data.pagination.total_count})`);
                break;
            }
        } catch (fetchError) {
            console.log(`[GIPHY DEBUG] Fetch error on page ${page + 1}: ${fetchError}`);
            break;
        }
    }

    const usableResults = collected.slice(0, desiredCount);
    console.log(`[GIPHY DEBUG] Final results: ${usableResults.length} GIFs with valid Reddit CDN URLs`);

    if (usableResults.length > 0) {
        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
        await context.redis.set(cacheKey, JSON.stringify(usableResults));
        await context.redis.expire(cacheKey, CACHE_TTL);
        console.log(`[GIPHY DEBUG] Cached ${usableResults.length} results for query: "${query}"`);
    }

    return usableResults;
}

/**
 * Search GIPHY GIFs for multiple queries in parallel and cache all results in Redis.
 */
export async function searchMultipleGiphyGifs(
    context: Context,
    queries: string[],
    limit: number = 4
): Promise<{ [query: string]: GiphyGifResult[] }> {
    console.log(`[GIPHY DEBUG] searchMultipleGiphyGifs called with ${queries.length} queries`);

    if (!queries || queries.length === 0) {
        return {};
    }

    const uniqueQueries = Array.from(new Set(queries.filter(q => q && q.trim() !== '')));

    if (uniqueQueries.length === 0) {
        return {};
    }

    try {
        const searchWithTimeout = async () => {
            const timeoutPromise = new Promise<{ [query: string]: GiphyGifResult[] }>((_, reject) => {
                setTimeout(() => reject(new Error('Batch search timeout')), 30000); // 30 second timeout
            });

            const searchPromise = (async () => {
                const resultMap: { [query: string]: GiphyGifResult[] } = {};
                const uncachedQueries: string[] = [];

                for (const query of uniqueQueries) {
                    try {
                        const cacheKey = `${GIPHY_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
                        const cachedData = await context.redis.get(cacheKey);
                        if (cachedData) {
                            const cachedResults = JSON.parse(cachedData);
                            if (cachedResults.length >= limit) {
                                resultMap[query] = cachedResults;
                                console.log(`[GIPHY DEBUG] Batch - found ${cachedResults.length} cached results for: "${query}"`);
                            } else {
                                uncachedQueries.push(query);
                            }
                        } else {
                            uncachedQueries.push(query);
                        }
                    } catch (cacheErr) {
                        console.log(`[GIPHY DEBUG] Batch - cache check error for "${query}": ${cacheErr}`);
                        uncachedQueries.push(query);
                    }
                }

                console.log(`[GIPHY DEBUG] Batch - ${uncachedQueries.length} queries need fetching (PARALLEL)`);

                // Process ALL queries in PARALLEL for speed
                // Each query will handle its own rate limiting internally
                const fetchPromises = uncachedQueries.map(async (query, index) => {
                    // Stagger start times slightly to avoid thundering herd
                    await new Promise(resolve => setTimeout(resolve, index * 200));
                    
                    try {
                        const results = await searchGiphyGifs(context, query, limit);
                        console.log(`[GIPHY DEBUG] Batch - fetched ${results.length} results for: "${query}"`);
                        return { query, results };
                    } catch (err) {
                        console.log(`[GIPHY DEBUG] Batch - error fetching "${query}": ${err}`);
                        return { query, results: [] as GiphyGifResult[] };
                    }
                });

                const fetchResults = await Promise.all(fetchPromises);
                
                for (const { query, results } of fetchResults) {
                    resultMap[query] = results;
                }

                console.log(`[GIPHY DEBUG] Batch - completed with ${Object.keys(resultMap).length} results`);
                return resultMap;
            })();

            return Promise.race([searchPromise, timeoutPromise]);
        };

        return await searchWithTimeout();
    } catch (error) {
        console.log(`[GIPHY DEBUG] Batch search error: ${error}`);
        const resultMap: { [query: string]: GiphyGifResult[] } = {};
        for (const query of uniqueQueries) {
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
        return resultMap;
    }
}
