import { Context } from '@devvit/public-api';

interface TenorGifFormat {
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
    tinygif: TenorGifFormat;
    mp4?: TenorGifFormat;
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

const TENOR_CACHE_PREFIX = 'tenor_search:';
const CACHE_TTL = 60 * 60 * 24; // 1 day

const GIF_CACHE_PREFIX = 'tenor_gif:';

async function cacheTenorGif(context: Context, tenorGif: TenorGifResult, maxRetries: number = 4): Promise<TenorGifResult> {
  const cacheKey = `${GIF_CACHE_PREFIX}${tenorGif.id}`;

  try {
    // 1. Check Redis cache for ALL formats
    const cachedFormats = await context.redis.get(cacheKey);
    if (cachedFormats) {
      return JSON.parse(cachedFormats);
    }

    // 2. Upload and cache only essential formats first (gif, tinygif) for speed
    const uploadedFormats: Record<string, TenorGifFormat> = {};

    // Helper: quick utility checks
    const isRedditCdn = (url?: string) => !!url && url.startsWith('https://i.redd.it/');

    // Helper: Verify URL is accessible with retries (Reddit CDN propagation delay)
    const verifyUrl = async (url: string, retries: number = maxRetries): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2500) // Balanced: faster than 3s, safer than 2s
          });
          if (response.ok) {
            return true;
          }
          // Moderate wait before retry
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 700)); // Balanced: faster than 1s, safer than 500ms
          }
        } catch (error) {
          // Wait before retry
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 700)); // Balanced timing
          }
        }
      }
      return false;
    };

    // Helper: fast upload with minimal retries
    const fastUpload = async (url: string): Promise<string> => {
      try {
        const uploadPromise = context.media.upload({ url, type: 'gif' });
        const result = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('upload-timeout')), 5000)) // Balanced: 5s (was 4s/6s)
        ]);
        // @ts-expect-error Result is from uploadPromise
        const mediaUrl: string = (result.mediaUrl as string) || url;
        return mediaUrl;
      } catch (err) {
        throw err; 
      }
    };

    // Upload only tinygif format for speed (smallest size, fastest upload/verification)
    const uploadPromises = ['tinygif'].map(async (format) => {
      const originalFormat = tenorGif.media_formats[format as keyof typeof tenorGif.media_formats];
      if (!originalFormat?.url) return { format, success: false };

      try {
        const mediaUrl = await fastUpload(originalFormat.url);
        if (isRedditCdn(mediaUrl)) {
          const isAccessible = await verifyUrl(mediaUrl);
          if (isAccessible) {
            uploadedFormats[format] = { ...originalFormat, url: mediaUrl };
            return { format, success: true };
          } else {
            return { format, success: false };
          }
        }
        return { format, success: false };
      } catch (error) {
        return { format, success: false };
      }
    });

    await Promise.allSettled(uploadPromises);

    // Keep gif format with original URL as fallback (not uploaded to avoid slowdown)
    if (tenorGif.media_formats.gif?.url) {
      uploadedFormats.gif = tenorGif.media_formats.gif;
    }

    // 3. Create final cached result (use uploaded tinygif) - MUST be Reddit CDN
    const preferredUrl = uploadedFormats.tinygif?.url || '';

    const cachedResult = {
      ...tenorGif,
      media_formats: {
        ...tenorGif.media_formats,
        ...uploadedFormats
      },
      url: preferredUrl
    };

    // ONLY accept Reddit CDN URLs - if upload failed, return empty to skip this GIF
    if (!isRedditCdn(cachedResult.url)) {
      return {
        ...cachedResult,
        url: '',
        media_formats: {
          ...cachedResult.media_formats,
          tinygif: cachedResult.media_formats.tinygif ? { ...cachedResult.media_formats.tinygif, url: '' } : cachedResult.media_formats.tinygif,
        },
      } as TenorGifResult;
    }

    // 4. Store ALL formats in Redis
    await context.redis.set(cacheKey, JSON.stringify(cachedResult));
    await context.redis.expire(cacheKey, CACHE_TTL);

    return cachedResult;

  } catch (error) {
    return tenorGif;
  }
}

export async function searchTenorGifs(
  context: Context,
  query: string,
  limit: number = 12
): Promise<TenorGifResult[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
    const cachedData = await context.redis.get(cacheKey);

    if (cachedData) {
      const results = JSON.parse(cachedData);
      if (results.length >= limit) {
        return results;
      }
    }
  } catch (cacheError) {
    // Cache error, continue to API
  }

  const apiKey = await context.settings.get('tenor-api-key');

  const clientKey = 'gif_enigma_devvit';

  // Smart strategy: fetch in batches and process until we have exactly 12
  const desiredCount = Math.max(1, limit);
  const collected: TenorGifResult[] = [];
  const seenIds = new Set<string>();
  
  // Pre-computed metadata cache for collected GIFs to avoid reprocessing
  interface GifMetadata {
    aspectRatio: number;
    duration: number;
    words: Set<string>;
  }
  const collectedMetadata = new Map<string, GifMetadata>();
  const commonWords = new Set(['gif', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'from']);
  
  // Helper: Extract metadata from GIF once
  const extractMetadata = (gif: TenorGifResult): GifMetadata | null => {
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
    
    return { aspectRatio, duration, words };
  };
  
  // Helper: Check if a GIF is visually similar to already collected GIFs
  const isSimilarToCollected = (newGif: TenorGifResult): boolean => {
    const newMeta = extractMetadata(newGif);
    if (!newMeta) return false;
    
    // Early exit if no collected GIFs yet
    if (collectedMetadata.size === 0) return false;
    
    // Check against all collected GIFs using pre-computed metadata
    for (const existingMeta of collectedMetadata.values()) {
      let similarityScore = 0;
      
      // 1. Aspect ratio check (fast math comparison)
      if (newMeta.aspectRatio > 0 && existingMeta.aspectRatio > 0) {
        const ratioDiff = Math.abs(newMeta.aspectRatio - existingMeta.aspectRatio) / existingMeta.aspectRatio;
        if (ratioDiff < 0.05) {
          similarityScore += 40;
        }
      }
      
      // 2. Duration check (fast comparison) - early exit if this + ratio < 70
      if (Math.abs(newMeta.duration - existingMeta.duration) < 0.2) {
        similarityScore += 30;
      }
      
      // Early exit: if score is already >= 70, it's a duplicate
      if (similarityScore >= 70) return true;
      
      // 3. Word overlap (only if needed to reach 70+ score)
      if (similarityScore >= 40 && newMeta.words.size > 0 && existingMeta.words.size > 0) {
        // Fast intersection using smaller set
        const [smaller, larger] = newMeta.words.size < existingMeta.words.size 
          ? [newMeta.words, existingMeta.words] 
          : [existingMeta.words, newMeta.words];
        
        let intersectionCount = 0;
        for (const word of smaller) {
          if (larger.has(word)) intersectionCount++;
        }
        
        const overlap = intersectionCount / smaller.size;
        if (overlap > 0.5) {
          similarityScore += 30;
        }
      }
      
      // If similarity score >= 70, consider it a duplicate
      if (similarityScore >= 70) return true;
    }
    
    return false;
  };
  
  let pos: string | undefined = undefined;
  let page = 0;
  const MAX_PAGES = 10; // Balanced: enough candidates to get 12 verified GIFs

  while (collected.length < desiredCount && page < MAX_PAGES) {
    // Fetch first page only (sequential pagination required for 'pos' token)
    const fetchLimit = 50; // Tenor's maximum
    const baseUrl: string = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&client_key=${clientKey}&media_filter=minimal&contentfilter=high&limit=${fetchLimit}`;
    const apiUrl: string = pos ? `${baseUrl}&pos=${encodeURIComponent(pos)}` : baseUrl;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GIF-Enigma/1.0',
        'Referer': 'https://www.reddit.com',
        'Origin': 'https://www.reddit.com',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Tenor API returned status ${response.status}`);
    }
    
    const data = await response.json();
    const pageResults = [data];
    
    for (const data of pageResults) {
      if (!data || !data.results) continue;

      const batchSize = 12; // Increased from 8 for faster parallel processing
      const results = data.results;

      for (let i = 0; i < results.length && collected.length < desiredCount; i += batchSize) {
        const batch = results.slice(i, i + batchSize);

        const batchResults: TenorGifResult[] = await Promise.all(
          batch.map(async (result: any) => {
            const mediaFormats = { ...result.media_formats };
            const requiredFormats = ['tinygif', 'gif'];
            requiredFormats.forEach((format) => {
              if (!mediaFormats[format]) {
                mediaFormats[format] = { url: '', dims: [0, 0], duration: 0, preview: '', size: 0 };
              }
            });

            const transformed = {
              id: result.id,
              title: result.title || '',
              media_formats: mediaFormats,
              content_description: result.content_description || result.title || '',
              created: result.created || Date.now(),
              hasaudio: result.hasaudio || false,
              url: result.url || '',
            };

            try {
              // Use 3 retries for balance of speed and reliability
              const cachedGif = await cacheTenorGif(context, transformed, 3);
              return cachedGif;
            } catch (error) {
              return transformed;
            }
          })
        );

        let addedInBatch = 0;
        for (const r of batchResults) {
          if (typeof r?.url === 'string' && r.url.startsWith('https://i.redd.it/') && !seenIds.has(r.id)) {
            // Skip if visually similar to already collected GIFs
            if (isSimilarToCollected(r)) {
              continue;
            }
            
            // Add to collected and cache its metadata
            collected.push(r);
            seenIds.add(r.id);
            const metadata = extractMetadata(r);
            if (metadata) {
              collectedMetadata.set(r.id, metadata);
            }
            
            addedInBatch++;
            if (collected.length >= desiredCount) break;
          }
        }

        if (collected.length >= desiredCount) break;
      }

      if (collected.length >= desiredCount) break;

      pos = data.next;
      page += 1;
      if (!pos) break;
    }
  }

  const usableResults = collected.slice(0, desiredCount);

  const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
  await context.redis.set(cacheKey, JSON.stringify(usableResults));
  await context.redis.expire(cacheKey, CACHE_TTL);

  return usableResults;
}

/**
 * Search Tenor GIFs for multiple queries in parallel and cache all results in Redis.
 * This is optimized for batch operations where you need GIFs for multiple synonyms at once.
 * 
 * @param context - Devvit context with Redis access
 * @param queries - Array of search queries (synonyms)
 * @param limit - Number of GIFs per query (default: 12)
 * @returns Object mapping each query to its GIF results
 */
export async function searchMultipleTenorGifs(
  context: Context,
  queries: string[],
  limit: number = 12
): Promise<{ [query: string]: TenorGifResult[] }> {
  if (!queries || queries.length === 0) {
    return {};
  }

  // Remove duplicates and empty queries
  const uniqueQueries = Array.from(new Set(queries.filter(q => q && q.trim() !== '')));

  if (uniqueQueries.length === 0) {
    return {};
  }

  try {
    const searchWithTimeout = async () => {
      const timeoutPromise = new Promise<{ [query: string]: TenorGifResult[] }>((_, reject) => {
        setTimeout(() => reject(new Error('Batch search timeout')), 50000); // Balanced timeout
      });

      const searchPromise = (async () => {
        const resultMap: { [query: string]: TenorGifResult[] } = {};
        const uncachedQueries: string[] = [];

        for (const query of uniqueQueries) {
          try {
            const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
            const cachedData = await context.redis.get(cacheKey);
            if (cachedData) {
              const cachedResults = JSON.parse(cachedData);
              if (cachedResults.length >= limit) {
                resultMap[query] = cachedResults;
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

        // Only fetch uncached queries
        if (uncachedQueries.length > 0) {
          const searchPromises = uncachedQueries.map(query => 
            searchTenorGifs(context, query, limit)
              .then(results => {
                return { query, results };
              })
              .catch(() => {
                return { query, results: [] };
              })
          );

          const fetchedResults = await Promise.all(searchPromises);
          fetchedResults.forEach(({ query, results }) => {
            resultMap[query] = results;
          });
        }

        return resultMap;
      })();

      return Promise.race([searchPromise, timeoutPromise]);
    };

    return await searchWithTimeout();
  } catch (error) {
    // Return partial results if available from cache
    const resultMap: { [query: string]: TenorGifResult[] } = {};
    for (const query of uniqueQueries) {
      try {
        const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
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
