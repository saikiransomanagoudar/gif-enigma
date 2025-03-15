import { Context } from '@devvit/public-api';
import { saveGame, getRecentGames, getGame, cacheGifResults, getCachedGifResults } from './gameHandler';

export async function saveGameRPC(params: {
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  postToSubreddit?: boolean;
}, context: Context) {
  try {
    const result = await saveGame(params, context);
    return result;
  } catch (error) {
    console.error('Error in saveGameRPC:', error);
    return { success: false, error: String(error) };
  }
}

export async function getRecentGamesRPC(params: { limit?: number }, context: Context) {
  try {
    const result = await getRecentGames(params, context);
    return result;
  } catch (error) {
    console.error('Error in getRecentGamesRPC:', error);
    return { success: false, error: String(error) };
  }
}

export async function getGameRPC(params: { gameId: string }, context: Context) {
  try {
    const result = await getGame(params, context);
    return result;
  } catch (error) {
    console.error('Error in getGameRPC:', error);
    return { success: false, error: String(error) };
  }
}

export async function cacheGifResultsRPC(params: { query: string; results: any[] }, context: Context) {
  try {
    const result = await cacheGifResults(params, context);
    return result;
  } catch (error) {
    console.error('Error in cacheGifResultsRPC:', error);
    return { success: false, error: String(error) };
  }
}

export async function getCachedGifResultsRPC(params: { query: string }, context: Context) {
  try {
    const result = await getCachedGifResults(params, context);
    return result;
  } catch (error) {
    console.error('Error in getCachedGifResultsRPC:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Proxy function to handle external requests and avoid CORS issues
 * This allows the webview to make requests to external services through your server
 */
export async function proxyRequestRPC(params: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}, context: unknown) {
  try {
    const { url, method = 'GET', headers = {}, body } = params;
    
    // Validate URL to prevent security issues
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Invalid URL' };
    }
    
    // Optional: Restrict to certain domains for security
    const allowedDomains = [
      'reddit.com',
      'redd.it',
      'redditcdn.com',
      'gfycat.com', 
      'giphy.com', 
      'imgur.com'
    ];
    
    const urlObj = new URL(url);
    const isDomainAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    
    if (!isDomainAllowed) {
      return { 
        success: false, 
        error: `Domain not allowed: ${urlObj.hostname}. Only specific domains are permitted.` 
      };
    }
    
    // Create a proper headers object that TypeScript can work with
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'GIF-Enigma/1.0',
      ...headers
    };
    
    // Add content-type if not already specified and we have a body
    if (method !== 'GET' && body && 
        !('Content-Type' in requestHeaders) && 
        !('content-type' in requestHeaders)) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    
    // Set up request options with properly typed headers
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders
    };
    
    // Add body for non-GET requests
    if (method !== 'GET' && body) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Handle binary responses differently
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('image/') || contentType.includes('video/')) {
      // For binary data, return a base64 encoded string
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      return {
        success: true,
        status: response.status,
        contentType,
        isBase64: true,
        data: base64
      };
    } else {
      // For text/JSON data, parse normally
      let data;
      try {
        data = await response.json();
      } catch (e) {
        // If not JSON, get as text
        data = await response.text();
      }
      
      return {
        success: true,
        status: response.status,
        contentType,
        data
      };
    }
  } catch (error) {
    console.error('Error in proxy request:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}