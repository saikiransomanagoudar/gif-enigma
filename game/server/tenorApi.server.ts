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
const CACHE_TTL = 60 * 60;

export async function searchTenorGifs(
  context: Context,
  query: string,
  limit: number = 8
): Promise<TenorGifResult[]> {
  console.log('🔍 [DEBUG] searchTenorGifs called with query:', query, 'limit:', limit);

  if (!query || query.trim() === '') {
    console.log('❌ [DEBUG] Empty query provided to searchTenorGifs');
    return [];
  }

  try {
    console.log('🔍 [DEBUG] Checking cache for query:', query);
    const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
    const cachedData = await context.redis.get(cacheKey);

    if (cachedData) {
      console.log('✅ [DEBUG] Found cached results for query:', query);
      try {
        const results = JSON.parse(cachedData);
        console.log(`✅ [DEBUG] Successfully parsed ${results.length} cached results`);
        return results;
      } catch (parseError) {
        console.error('❌ [DEBUG] Error parsing cached results:', parseError);
      }
    } else {
      console.log('ℹ️ [DEBUG] No cached results found for query:', query);
    }
  } catch (cacheError) {
    console.error('❌ [DEBUG] Error checking cache:', cacheError);
  }

  console.log('🌐 [DEBUG] Proceeding with API call for query:', query);

  try {
    console.log('🔑 [DEBUG] Getting API key from settings');
    const apiKey = await context.settings.get('tenor-api-key');

    if (!apiKey) {
      console.error('❌ [DEBUG] Tenor API key not configured in app settings');
    }

    console.log(
      '✅ [DEBUG] API key retrieved successfully:',
      apiKey ? 'Key exists (not shown)' : 'No key found'
    );

    const clientKey = 'gif_enigma_devvit';
    const apiUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&client_key=${clientKey}&media_filter=gif,tinygif,mediumgif,nanogif&contentfilter=high&limit=${limit}`;
    console.log('🌐 [DEBUG] API URL (masked):', apiUrl.replace(String(apiKey), 'API_KEY_HIDDEN'));

    console.log('⏳ [DEBUG] Making fetch request to Tenor API...');

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GIF-Enigma/1.0',
        'Referer': 'https://www.reddit.com',
        'Origin': 'https://www.reddit.com',
      },
    });

    console.log('📊 [DEBUG] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [DEBUG] Tenor API error response: ${errorText}`);
      throw new Error(`Tenor API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    console.log('🔍 [DEBUG] Raw response data sample:', JSON.stringify(data).substring(0, 200) + '...');

    if (!data || !data.results) {
      console.error('❌ [DEBUG] Invalid response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid response structure from Tenor API');
    }

    console.log(`✅ [DEBUG] Found ${data.results.length} GIFs from Tenor API`);

    if (data.results.length > 0) {
      console.log('🔍 [DEBUG] First result example:', JSON.stringify(data.results[0]).substring(0, 500));
      
      const hasMediaFormats = !!data.results[0].media_formats;
      console.log('🔍 [DEBUG] Has media_formats:', hasMediaFormats);
      
      if (hasMediaFormats) {
        const formats = Object.keys(data.results[0].media_formats);
        console.log('🔍 [DEBUG] Available formats:', formats);
        
        console.log('🔍 [DEBUG] GIF URL:', data.results[0].media_formats.gif?.url || 'Not found');
        console.log('🔍 [DEBUG] TinyGIF URL:', data.results[0].media_formats.tinygif?.url || 'Not found');
      }
    }

    const transformedResults = data.results.map((result: any) => {
      
      const mediaFormats = { ...result.media_formats };
      if (!mediaFormats.gif) {
        mediaFormats.gif = {
          url: '',
          dims: [0, 0],
          duration: 0,
          preview: '',
          size: 0,
        };
      }
      
      if (!mediaFormats.tinygif) {
        mediaFormats.tinygif = {
          url: '',
          dims: [0, 0],
          duration: 0,
          preview: '',
          size: 0,
        };
      }
      
      if (!mediaFormats.mediumgif) {
        mediaFormats.mediumgif = {
          url: '',
          dims: [0, 0],
          duration: 0,
          preview: '',
          size: 0,
        };
      }

      if (!mediaFormats.nanogif) {
        mediaFormats.nanogif = {
          url: '',
          dims: [0, 0],
          duration: 0,
          preview: '',
          size: 0,
        };
      }

      return {
        id: result.id,
        title: result.title || '',
        media_formats: mediaFormats,
        content_description: result.content_description || result.title || '',
        created: result.created || Date.now(),
        hasaudio: result.hasaudio || false,
        url: result.url || '',
      };
    });

    console.log('🔍 [DEBUG] First transformed result:', JSON.stringify(transformedResults[0]).substring(0, 500));

    try {
      const cacheKey = `${TENOR_CACHE_PREFIX}${encodeURIComponent(query.toLowerCase().trim())}`;
      await context.redis.set(cacheKey, JSON.stringify(transformedResults));
      await context.redis.expire(cacheKey, CACHE_TTL);
      console.log('📦 [DEBUG] Successfully cached transformed results');
    } catch (cacheError) {
      console.error('⚠️ [DEBUG] Error caching results:', cacheError);
    }

    return transformedResults;
  } catch (error) {
    console.error('❌ [DEBUG] Error with API call:', error);
    console.log('🎭 [DEBUG] Falling back to mock results');
    throw new Error('Error fetching GIFs from Tenor API');
  }
}


