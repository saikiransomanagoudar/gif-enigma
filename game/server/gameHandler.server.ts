import { saveGame, getRecentGames, getGame, cacheGifResults, getCachedGifResults, getUserGames } from './gameHandler';

// Direct function exports - no RPC wrappers needed anymore
export { saveGame, getRecentGames, getGame, cacheGifResults, getCachedGifResults, getUserGames };

/**
 * fetchRequest function to handle external requests and avoid CORS issues.
 * This version uses fetch (like in tenorApi.server.ts) and adds detailed debug logging.
 */
export async function fetchRequest(
  params: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
  },
  _context: unknown
) {
  console.log('🔍 [DEBUG] fetchRequest called with:', {
    url: params.url,
    method: params.method || 'GET',
    headers: params.headers,
    hasBody: !!params.body,
  });

  try {
    const { url, method = 'GET', headers = {}, body } = params;

    // Validate URL to prevent security issues
    if (!url || typeof url !== 'string') {
      console.error('❌ [DEBUG] Invalid URL provided:', url);
      return { success: false, error: 'Invalid URL' };
    }
    console.log('✅ [DEBUG] URL is valid:', url);

    // Optional: Restrict to certain domains for security
    const allowedDomains = [
      'reddit.com',
      'redd.it',
      'redditcdn.com',
      'tenor.com',
      'giphy.com',
    ];
    const urlObj = new URL(url);
    const isDomainAllowed = allowedDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    if (!isDomainAllowed) {
      console.error('❌ [DEBUG] Domain not allowed:', urlObj.hostname);
      return { 
        success: false, 
        error: `Domain not allowed: ${urlObj.hostname}. Only specific domains are permitted.` 
      };
    }
    console.log('✅ [DEBUG] Domain is allowed:', urlObj.hostname);

    // Create headers object with default User-Agent
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'GIF-Enigma/1.0',
      ...headers
    };

    // Set Content-Type if we have a body and it's not already set
    if (method !== 'GET' && body && !('Content-Type' in requestHeaders) && !('content-type' in requestHeaders)) {
      requestHeaders['Content-Type'] = 'application/json';
      console.log('🔍 [DEBUG] Setting Content-Type to application/json');
    }

    // Set up request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders
    };

    if (method !== 'GET' && body) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      console.log('🔍 [DEBUG] Attached request body');
    }

    console.log('🌐 [DEBUG] Making fetch request:', { method: requestOptions.method, url });
    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get('content-type') || '';

    console.log('📊 [DEBUG] Response status:', response.status);
    console.log('📊 [DEBUG] Response content-type:', contentType);

    // If binary data, return base64 encoded string
    if (contentType.includes('image/') || contentType.includes('video/')) {
      console.log('🔍 [DEBUG] Handling binary response (image/video)');
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      console.log('✅ [DEBUG] Returning binary data');
      return {
        success: true,
        status: response.status,
        contentType,
        isBase64: true,
        data: base64
      };
    } else {
      // Otherwise, parse as JSON or text
      let data;
      try {
        data = await response.json();
        console.log('✅ [DEBUG] JSON response parsed successfully');
      } catch (jsonError) {
        console.warn('⚠️ [DEBUG] Failed to parse JSON, falling back to text:', jsonError);
        data = await response.text();
      }
      console.log('✅ [DEBUG] Returning text/JSON response');
      return {
        success: true,
        status: response.status,
        contentType,
        data
      };
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error in fetchRequest:', error);
    return { success: false, error: String(error) };
  }
}
