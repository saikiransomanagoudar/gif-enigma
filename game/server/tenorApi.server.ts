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

    // Helper: fast upload with minimal retries
    const fastUpload = async (url: string): Promise<string> => {
      try {
        const uploadPromise = context.media.upload({ url, type: 'gif' });
        const result = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('upload-timeout')), 1000))
        ]);
        // @ts-expect-error Result is from uploadPromise
        const mediaUrl: string = (result.mediaUrl as string) || url;
        return mediaUrl;
      } catch (err) {
        throw err;
      }
    };

    // Upload both formats simultaneously with fast timeouts
    const uploadPromises = ['gif', 'tinygif'].map(async (format) => {
      const originalFormat = tenorGif.media_formats[format as keyof typeof tenorGif.media_formats];
      if (!originalFormat?.url) return { format, success: false };
      
      try {
        const mediaUrl = await fastUpload(originalFormat.url);
        if (isRedditCdn(mediaUrl)) {
          // Quick verification - if it fails, we'll catch it later
          uploadedFormats[format] = { ...originalFormat, url: mediaUrl };
          return { format, success: true };
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

    // 3. Create final cached result (prefer gif, then tinygif) and ensure only i.redd.it is returned
    const preferredUrl = uploadedFormats.gif?.url || uploadedFormats.tinygif?.url || '';

    const cachedResult = {
      ...tenorGif,
      media_formats: {
        ...tenorGif.media_formats,
        ...uploadedFormats
      },
      url: preferredUrl
    };

    // If we still don't have a valid Reddit CDN URL, do not cache to avoid re-serving bad URLs
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
    console.warn('Non-fatal: cacheTenorGif fallback to original URLs due to error.', error);
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
      try {
        const results = JSON.parse(cachedData);
        return results;
      } catch (parseError) {
        // Cache corrupted, continue to API
      }
    }
  } catch (cacheError) {
    // Cache error, continue to API
  }

  try {
    const apiKey = await context.settings.get('tenor-api-key');

    if (!apiKey) {
      console.error('Tenor API key not configured in app settings');
    }

    const clientKey = 'gif_enigma_devvit';

    // Smart strategy: fetch in batches and process until we have exactly 16
    const desiredCount = Math.max(1, limit);
    const collected: TenorGifResult[] = [];
    const seenIds = new Set<string>();
    let pos: string | undefined = undefined;
    let page = 0;
    const MAX_PAGES = 4; // Allow more pages but with smarter batching

    while (collected.length < desiredCount && page < MAX_PAGES) {
      // Fetch large batches but process them efficiently
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
              console.error('Error caching GIF:', error);
              return transformed;
            }
          })
        );

        // Add successful uploads with lenient verification
        for (const r of batchResults) {
          if (typeof r?.url === 'string' && r.url.startsWith('https://i.redd.it/') && !seenIds.has(r.id)) {
            // Verify URL works with more lenient timeout
            try {
              const checkResponse = await fetch(r.url, { 
                method: 'HEAD', 
                signal: AbortSignal.timeout(2000) // Increased from 800ms to 2s
              });
              if (checkResponse.ok) {
                collected.push(r);
                seenIds.add(r.id);
                if (collected.length >= desiredCount) break;
              } else {
                seenIds.add(r.id); // Mark as seen to avoid retrying
              }
            } catch {
              // Skip broken/slow URLs
              seenIds.add(r.id);
            }
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

    try {
      const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
      await context.redis.set(cacheKey, JSON.stringify(usableResults));
      await context.redis.expire(cacheKey, CACHE_TTL);
    } catch (cacheError) {
      // Cache error, continue
    }

    return usableResults;
  } catch (error) {
    console.error('Error with API call:', error);
    throw new Error('Error fetching GIFs from Tenor API');
  }
}
