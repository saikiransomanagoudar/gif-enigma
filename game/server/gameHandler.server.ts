import { Context } from '@devvit/public-api';
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
  getUnplayedGames,
  trackGuess,
  getGameStatistics,
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
  trackGuess,
  getGameStatistics,
};

export async function getRandomGame(
  params: { excludeIds?: string[]; preferUserCreated?: boolean; username?: string },
  context: any
) {
  try {
    console.log('[getRandomGame] Starting with params:', params);
    const { excludeIds = [], preferUserCreated = true, username } = params;
    
    // Resolve username to match the resolution done in MARK_GAME_COMPLETED
    let resolvedUsername: string | null = null;
    const incoming = String(username || '').trim();
    if (incoming && incoming.toLowerCase() !== 'anonymous') {
      resolvedUsername = incoming.replace(/^u\//i, '');
    } else {
      // If username is 'anonymous' or empty, try to fetch the actual username
      const fetched = await context.reddit.getCurrentUsername();
      if (fetched) resolvedUsername = fetched;
    }
    
    console.log('[getRandomGame] Resolved username:', resolvedUsername);
    
    let completedGames: string[] = [];
    let recentlyViewedGames: string[] = [];
    
    if (resolvedUsername) {
      const completedGamesKey = `user:${resolvedUsername}:completedGames`;
      
      const rangeResult = await context.redis.zRange(completedGamesKey, 0, -1, {
        by: 'score',
      });
      
      completedGames = rangeResult.map((item: { member: any }) =>
        typeof item === 'string' ? item : item.member
      );
      console.log('[getRandomGame] Found completed games:', completedGames.length);
      
      // Get recently viewed games (within last 5 minutes)
      const recentlyViewedKey = `user:${resolvedUsername}:recentlyViewed`;
      const viewedResult = await context.redis.zRange(recentlyViewedKey, 0, -1, {
        by: 'score',
      });
      
      recentlyViewedGames = viewedResult.map((item: { member: any }) =>
        typeof item === 'string' ? item : item.member
      );
      console.log('[getRandomGame] Found recently viewed games:', recentlyViewedGames.length);
    }

    const allExcluded = [...new Set([...excludeIds, ...completedGames, ...recentlyViewedGames])];

    const gameMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
      by: 'score',
      reverse: true,
    });
    
    console.log('[getRandomGame] Total active games:', gameMembers.length);
    
    // Limit to 20 games for faster response - prioritize speed over selection variety
    const maxGamesToCheck = Math.min(gameMembers.length, 20);
    const gamesToCheck = gameMembers.slice(0, maxGamesToCheck);
    
    console.log('[getRandomGame] Checking games:', maxGamesToCheck);
    
    const gamesWithDates: Array<{ gameId: string; createdAt: number; isUserCreated: boolean }> = [];
    
    // Early exit: if we find 5 valid games, stop checking more
    const targetValidGames = 5;

    for (const item of gamesToCheck) {
      // Stop if we already have enough valid games
      if (gamesWithDates.length >= targetValidGames) {
        break;
      }
      
      const gameId = typeof item === 'string' ? item : item.member;

      if (allExcluded.includes(gameId)) {
        continue;
      }

      // Check if user has already played or given up on this game
      if (resolvedUsername) {
        const gameStateKey = `gameState:${gameId}:${resolvedUsername}`;
        const gameState = await context.redis.hGetAll(gameStateKey);
        
        if (gameState && gameState.playerState) {
          try {
            const parsedState = JSON.parse(gameState.playerState);
            // Skip games where user has completed or given up
            if (parsedState.isCompleted || parsedState.hasGivenUp) {
              continue;
            }
          } catch (e) {
            // If parsing fails, continue checking this game
          }
        }
      }

      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      const createdAt = parseInt(gameData.createdAt || '0');

      if (!gameData.redditPostId || !gameData.word) {
        continue;
      }

      const isRemoved = gameData.isRemoved === 'true';
      if (isRemoved) {
        continue;
      }

      // Skip real-time Reddit API check during game selection to improve performance
      // The check will happen when the user tries to actually play the game

      let hasValidGifs = false;
      if (gameData?.gifs) {
        const gifs = JSON.parse(gameData.gifs);
        hasValidGifs = Array.isArray(gifs) && gifs.length > 0;
      }

      if (hasValidGifs) {
        const isUserCreated =
          gameData.creatorId &&
          gameData.creatorId !== 'anonymous' &&
          gameData.creatorId !== 'system';

        gamesWithDates.push({
          gameId,
          createdAt,
          isUserCreated: !!isUserCreated,
        });
      }
    }

    gamesWithDates.sort((a, b) => b.createdAt - a.createdAt);

    // Use all found games instead of slicing to 10 since we already limited the search
    const recentGames = gamesWithDates;
    
    console.log('[getRandomGame] Valid games found:', recentGames.length);

    if (recentGames.length === 0) {
      // Check if there are any games at all in the system
      const totalGamesCount = gameMembers.length;
      const hasPlayedAllGames = resolvedUsername && completedGames.length > 0 && totalGamesCount > 0;
      
      console.log('[getRandomGame] No valid games. hasPlayedAll:', hasPlayedAllGames);
      
      return {
        success: false,
        error: hasPlayedAllGames 
          ? 'You have played all available games! Check back later for new games or create your own.'
          : 'No games available yet. Be the first to create one!',
        requestedUserCreated: preferUserCreated,
        hasPlayedAll: hasPlayedAllGames,
      };
    }

    let candidatePool = recentGames;
    if (preferUserCreated) {
      const userCreatedGames = recentGames.filter((game) => game.isUserCreated);
      if (userCreatedGames.length > 0) {
        candidatePool = userCreatedGames;
      }
    }

    // Select a random game from the candidates
    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    const selectedGame = candidatePool[randomIndex];
    const randomGameId = selectedGame.gameId;
    
    console.log('[getRandomGame] Selected game:', randomGameId);

    const gameResult = await getGame({ gameId: randomGameId }, context);
    
    console.log('[getRandomGame] Returning result, success:', gameResult.success);

    return gameResult;
  } catch (error) {
    console.error('[getRandomGame] Error:', error);
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
  try {
    const { url, method = 'GET', headers = {}, body } = params;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Invalid URL' };
    }
    const allowedDomains = ['reddit.com', 'redd.it', 'redditcdn.com', 'tenor.com', 'giphy.com'];
    const urlObj = new URL(url);
    const isDomainAllowed = allowedDomains.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    if (!isDomainAllowed) {
      return {
        success: false,
        error: `Domain not allowed: ${urlObj.hostname}. Only specific domains are permitted.`,
      };
    }
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'GIF-Enigma/1.0',
      ...headers,
    };
    if (
      method !== 'GET' &&
      body &&
      !('Content-Type' in requestHeaders) &&
      !('content-type' in requestHeaders)
    ) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (method !== 'GET' && body) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('image/') || contentType.includes('video/')) {
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return {
        success: true,
        status: response.status,
        contentType,
        isBase64: true,
        data: base64,
      };
    } else {
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        data = await response.text();
      }
      return {
        success: true,
        status: response.status,
        contentType,
        data,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function removeSystemUsersFromLeaderboard(context: Context) {
  try {
    const systemUsernames = [
      'gif-enigma',
      'anonymous', 
      'GIFEnigmaBot', 
      'system',
      'Most-Client-2219',
      'steve-sid',
      'seamless_ghost'
    ];
    
    for (const username of systemUsernames) {
      await context.redis.zRem('cumulativeLeaderboard', [username]);
      await context.redis.del(`userStats:${username}`);
    }
    
    const globalLeaderboardEntries = await context.redis.zRange('globalLeaderboard', 0, -1);
    
    for (const entry of globalLeaderboardEntries) {
      const id = typeof entry === 'string' ? entry : entry.member;
      
      if (systemUsernames.some(username => id.includes(`:${username}`))) {
        await context.redis.zRem('globalLeaderboard', [id]);
      }
    }
    
    const leaderboardKeys = await context.redis.hkeys('leaderboard:*');
    
    for (const leaderboardKey of leaderboardKeys) {
      for (const username of systemUsernames) {
        await context.redis.zRem(leaderboardKey, [username]);
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
