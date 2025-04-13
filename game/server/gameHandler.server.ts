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
    const { excludeIds = [], preferUserCreated = true, username } = params;
    let completedGames: string[] = [];
    if (username) {
      const rangeResult = await context.redis.zRange(`user:${username}:completedGames`, 0, -1, {
        by: 'score',
      });
      completedGames = rangeResult.map((item: { member: any }) =>
        typeof item === 'string' ? item : item.member
      );
    }

    const allExcluded = [...new Set([...excludeIds, ...completedGames])];

    const gameMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
      by: 'score',
      reverse: true,
    });
    const gamesWithDates: Array<{ gameId: string; createdAt: number; isUserCreated: boolean }> = [];

    for (const item of gameMembers) {
      const gameId = typeof item === 'string' ? item : item.member;

      if (allExcluded.includes(gameId)) {
        continue;
      }

      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      const createdAt = parseInt(gameData.createdAt || '0');

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

    const recentGames = gamesWithDates.slice(0, 10);

    if (recentGames.length === 0) {
      return {
        success: false,
        error: 'No valid recent games available',
        requestedUserCreated: preferUserCreated,
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

    const gameResult = await getGame({ gameId: randomGameId }, context);

    return gameResult;
  } catch (error) {
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
    console.log('🧹 [DEBUG] Removing system users from leaderboards...');
    
    // List of system usernames to remove from leaderboards
    const systemUsernames = [
      'gif-enigma',
      'anonymous', 
      'GIFEnigmaBot', 
      'system'
    ];
    
    // Remove from cumulative leaderboard
    for (const username of systemUsernames) {
      await context.redis.zRem('cumulativeLeaderboard', [username]);
      console.log(`✅ [DEBUG] Removed ${username} from cumulative leaderboard`);
      
      // Also delete their user stats
      await context.redis.del(`userStats:${username}`);
      console.log(`✅ [DEBUG] Deleted user stats for ${username}`);
    }
    
    // Remove from global leaderboard - a bit trickier since IDs contain gameId:username
    const globalLeaderboardEntries = await context.redis.zRange('globalLeaderboard', 0, -1);
    
    for (const entry of globalLeaderboardEntries) {
      const id = typeof entry === 'string' ? entry : entry.member;
      
      // Check if this entry contains a system username
      if (systemUsernames.some(username => id.includes(`:${username}`))) {
        await context.redis.zRem('globalLeaderboard', [id]);
        console.log(`✅ [DEBUG] Removed ${id} from global leaderboard`);
      }
    }
    
    // Get all game-specific leaderboards
    const leaderboardKeys = await context.redis.hkeys('leaderboard:*');
    
    // For each game-specific leaderboard
    for (const leaderboardKey of leaderboardKeys) {
      for (const username of systemUsernames) {
        await context.redis.zRem(leaderboardKey, [username]);
        console.log(`✅ [DEBUG] Removed ${username} from ${leaderboardKey}`);
      }
    }
    
    console.log('✅ [DEBUG] Successfully cleaned all leaderboards of system users');
    return { success: true };
  } catch (error) {
    console.error('❌ [DEBUG] Error removing system users from leaderboard:', error);
    return { success: false, error: String(error) };
  }
}
