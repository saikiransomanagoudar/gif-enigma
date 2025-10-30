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
    gif: TenorGifFormat;
    tinygif: TenorGifFormat;
    mediumgif: TenorGifFormat;
    nanogif: TenorGifFormat;
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

const TENOR_CACHE_PREFIX = 'tenor_search:';
const CACHE_TTL = 60 * 60 * 24; // 1 day

const GIF_CACHE_PREFIX = 'tenor_gif:';

async function cacheTenorGif(context: Context, tenorGif: TenorGifResult): Promise<TenorGifResult> {
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
    const verifyUrl = async (url: string, maxRetries: number = 2): Promise<boolean> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(1500) // 1.5s timeout
          });
          if (response.ok) {
            return true;
          }
          // Wait before retry (CDN propagation)
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 800)); // Wait 800ms for CDN propagation
          }
        } catch (error) {
          // Wait before retry
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
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
          new Promise((_, reject) => setTimeout(() => reject(new Error('upload-timeout')), 3000)) // Increased to 3s
        ]);
        // @ts-expect-error Result is from uploadPromise
        const mediaUrl: string = (result.mediaUrl as string) || url;
        return mediaUrl;
      } catch (err) {
        throw err; // Must throw so we don't accept failed uploads
      }
    };

    // Upload both formats simultaneously with fast timeouts
    const uploadPromises = ['gif', 'tinygif'].map(async (format) => {
      const originalFormat = tenorGif.media_formats[format as keyof typeof tenorGif.media_formats];
      if (!originalFormat?.url) return { format, success: false };

      try {
        const mediaUrl = await fastUpload(originalFormat.url);
        // ONLY accept Reddit CDN URLs - Tenor URLs don't work in Reddit
        if (isRedditCdn(mediaUrl)) {
          // Verify URL is accessible with retries (handles CDN propagation delay)
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

    // Non-essential formats keep original URLs (mediumgif, nanogif)
    (['mediumgif', 'nanogif'] as const).forEach((format) => {
      const originalFormat = tenorGif.media_formats[format];
      if (originalFormat?.url) {
        uploadedFormats[format] = originalFormat;
      }
    });

    // 3. Create final cached result (prefer gif, then tinygif) - MUST be Reddit CDN
    const preferredUrl = uploadedFormats.gif?.url || uploadedFormats.tinygif?.url || '';

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
          gif: cachedResult.media_formats.gif ? { ...cachedResult.media_formats.gif, url: '' } : cachedResult.media_formats.gif,
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
  limit: number = 16
): Promise<TenorGifResult[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
    const cachedData = await context.redis.get(cacheKey);

    if (cachedData) {
      const results = JSON.parse(cachedData);
      return results;
    }
  } catch (cacheError) {
    // Cache error, continue to API
  }

  const apiKey = await context.settings.get('tenor-api-key');

  const clientKey = 'gif_enigma_devvit';

  // Smart strategy: fetch in batches and process until we have exactly 16
  const desiredCount = Math.max(1, limit);
  const collected: TenorGifResult[] = [];
  const seenIds = new Set<string>();
  let pos: string | undefined = undefined;
  let page = 0;
  const MAX_PAGES = 5; // Allow more pages to ensure we get 16 GIFs

  while (collected.length < desiredCount && page < MAX_PAGES) {
    // Fetch larger batches to ensure we get 16 valid GIFs
    const fetchLimit = 50; // Maximum per page
    const baseUrl: string = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&client_key=${clientKey}&media_filter=gif,tinygif,mediumgif,nanogif&contentfilter=high&limit=${fetchLimit}`;
    const apiUrl: string = pos ? `${baseUrl}&pos=${encodeURIComponent(pos)}` : baseUrl;
    const response: Response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GIF-Enigma/1.0',
        'Referer': 'https://www.reddit.com',
        'Origin': 'https://www.reddit.com',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tenor API returned status ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    if (!data || !data.results) {
      throw new Error('Invalid response structure from Tenor API');
    }

    // Process results in parallel batches for maximum speed
    const batchSize = 20; // Process 20 at a time for maximum speed
    const results = data.results;

    for (let i = 0; i < results.length && collected.length < desiredCount; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      const batchResults: TenorGifResult[] = await Promise.all(
        batch.map(async (result: any) => {
          const mediaFormats = { ...result.media_formats };
          const requiredFormats = ['gif', 'tinygif', 'mediumgif', 'nanogif'];
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
            const cachedGif = await cacheTenorGif(context, transformed);
            return cachedGif;
          } catch (error) {
            return transformed;
          }
        })
      );

      // ONLY add GIFs with valid Reddit CDN URLs
      let addedInBatch = 0;
      for (const r of batchResults) {
        // MUST be Reddit CDN URL - Tenor URLs don't work in Reddit
        if (typeof r?.url === 'string' && r.url.startsWith('https://i.redd.it/') && !seenIds.has(r.id)) {
          collected.push(r);
          seenIds.add(r.id);
          addedInBatch++;
          if (collected.length >= desiredCount) break;
        }
      }
      
      // Stop processing if we have enough verified GIFs
      if (collected.length >= desiredCount) break;
    }

    pos = data.next;
    page += 1;
    if (!pos) break; // no more pages
  }

  // Results are already verified during collection, just slice to desired count
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
 * @param limit - Number of GIFs per query (default: 16)
 * @returns Object mapping each query to its GIF results
 */
export async function searchMultipleTenorGifs(
  context: Context,
  queries: string[],
  limit: number = 16
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
    // Search all queries in parallel for maximum speed
    const searchPromises = uniqueQueries.map(query => 
      searchTenorGifs(context, query, limit)
        .then(results => {
          return { query, results };
        })
        .catch(() => {
          return { query, results: [] };
        })
    );

    const allResults = await Promise.all(searchPromises);

    // Convert array to object map
    const resultMap: { [query: string]: TenorGifResult[] } = {};
    allResults.forEach(({ query, results }) => {
      resultMap[query] = results;
    });
    return resultMap;
  } catch (error) {
    return {};
  }
}
