import {
  saveGame,
  getRecentGames,
  getGame,
  cacheGifResults,
  getCachedGifResults,
  getUserGames,
  postCompletionComment,
  hasUserCompletedGame,
  saveGameState,
  getGameState,
  getUnplayedGames
} from './gameHandler';

import {
  saveScore,
  getGameLeaderboard,
  getGlobalLeaderboard,
  getUserScores,
  calculateScore,
  getCumulativeLeaderboard,
} from './scoringService';

export {
  saveGame,
  getRecentGames,
  getGame,
  cacheGifResults,
  getCachedGifResults,
  getUserGames,
  saveScore,
  getGameLeaderboard,
  getGlobalLeaderboard,
  getUserScores,
  calculateScore,
  getCumulativeLeaderboard,
  postCompletionComment,
  hasUserCompletedGame,
  saveGameState,
  getGameState,
  getUnplayedGames,
};

export async function getRandomGame(
  params: { excludeIds?: string[]; preferUserCreated?: boolean; username?: string },
  context: any
) {
  try {
    console.log('🔍 [DEBUG] getRandomGame called with params:', params);
    const { excludeIds = [], preferUserCreated = true, username } = params;

    // Get user's completed games from Redis if username is provided
    let completedGames: string[] = [];
    if (username) {
      const rangeResult = await context.redis.zRange(`user:${username}:completedGames`, 0, -1, {
        by: 'score',
      });
      completedGames = rangeResult.map((item: { member: any; }) =>
        typeof item === 'string' ? item : item.member
      );
      console.log('🔍 [DEBUG] User completed games:', completedGames);
    }

    // Combine client-side exclusions with server-side completed games
    const allExcluded = [...new Set([...excludeIds, ...completedGames])];
    console.log('🔍 [DEBUG] All excluded game IDs:', allExcluded);

    // Get all active games sorted by score (newest first)
    const gameMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
      by: 'score',
      reverse: true, // Get newest games first
    });

    console.log('🔍 [DEBUG] Found games in activeGames:', gameMembers.length);

    // Store games with their creation dates for later sorting
    const gamesWithDates: Array<{gameId: string, createdAt: number, isUserCreated: boolean}> = [];

    for (const item of gameMembers) {
      const gameId = typeof item === 'string' ? item : item.member;

      // Skip excluded games
      if (allExcluded.includes(gameId)) {
        continue;
      }

      // Get game data
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      const createdAt = parseInt(gameData.createdAt || '0');

      // Check if game has valid GIFs
      let hasValidGifs = false;
      if (gameData?.gifs) {
        try {
          const gifs = JSON.parse(gameData.gifs);
          hasValidGifs = Array.isArray(gifs) && gifs.length > 0;
        } catch (e) {
          console.error(`Error parsing gifs for game ${gameId}:`, e);
        }
      }

      if (hasValidGifs) {
        const isUserCreated = gameData.creatorId && 
                             gameData.creatorId !== 'anonymous' && 
                             gameData.creatorId !== 'system';
        
        gamesWithDates.push({
          gameId,
          createdAt,
          isUserCreated: !!isUserCreated
        });
      }
    }

    // Sort by creation date (newest first)
    gamesWithDates.sort((a, b) => b.createdAt - a.createdAt);
    
    // Get the 10 most recent games
    const recentGames = gamesWithDates.slice(0, 10);
    console.log('✅ [DEBUG] Filtered to 10 most recent games:', recentGames.length);

    if (recentGames.length === 0) {
      console.error('❌ [DEBUG] No valid recent games available');
      return {
        success: false,
        error: 'No valid recent games available',
        requestedUserCreated: preferUserCreated,
      };
    }

    // Filter by user preference if possible
    let candidatePool = recentGames;
    if (preferUserCreated) {
      const userCreatedGames = recentGames.filter(game => game.isUserCreated);
      if (userCreatedGames.length > 0) {
        candidatePool = userCreatedGames;
      }
    }

    // Select a random game from the candidates
    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    const selectedGame = candidatePool[randomIndex];
    const randomGameId = selectedGame.gameId;
    
    console.log('✅ [DEBUG] Selected random game:', randomGameId, 'created at:', new Date(selectedGame.createdAt).toISOString());

    // Get the full game data
    const gameResult = await getGame({ gameId: randomGameId }, context);

    return gameResult;
  } catch (error) {
    console.error('❌ [DEBUG] Error getting random game:', error);
    return { success: false, error: String(error) };
  }
}

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

    const allowedDomains = ['reddit.com', 'redd.it', 'redditcdn.com', 'tenor.com', 'giphy.com'];
    const urlObj = new URL(url);
    const isDomainAllowed = allowedDomains.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    if (!isDomainAllowed) {
      console.error('❌ [DEBUG] Domain not allowed:', urlObj.hostname);
      return {
        success: false,
        error: `Domain not allowed: ${urlObj.hostname}. Only specific domains are permitted.`,
      };
    }
    console.log('✅ [DEBUG] Domain is allowed:', urlObj.hostname);

    // Create headers object with default User-Agent
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'GIF-Enigma/1.0',
      ...headers,
    };

    // Set Content-Type if we have a body and it's not already set
    if (
      method !== 'GET' &&
      body &&
      !('Content-Type' in requestHeaders) &&
      !('content-type' in requestHeaders)
    ) {
      requestHeaders['Content-Type'] = 'application/json';
      console.log('🔍 [DEBUG] Setting Content-Type to application/json');
    }

    // Set up request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
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
        data: base64,
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
        data,
      };
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error in fetchRequest:', error);
    return { success: false, error: String(error) };
  }
}