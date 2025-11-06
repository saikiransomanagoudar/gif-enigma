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
  validateGuess,
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
  validateGuess,
};

export async function getRandomGame(
  params: { excludeIds?: string[]; preferUserCreated?: boolean; username?: string },
  context: any
) {
  try {
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
      
      // Get recently viewed games (within last 5 minutes)
      const recentlyViewedKey = `user:${resolvedUsername}:recentlyViewed`;
      const viewedResult = await context.redis.zRange(recentlyViewedKey, 0, -1, {
        by: 'score',
      });
      
      recentlyViewedGames = viewedResult.map((item: { member: any }) =>
        typeof item === 'string' ? item : item.member
      );
    }

    const allExcluded = [...new Set([...excludeIds, ...completedGames, ...recentlyViewedGames])];

    const gameMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
      by: 'score',
      reverse: true,
    });
    
    // Limit to 50 games but process efficiently with batch operations
    const maxGamesToCheck = Math.min(gameMembers.length, 50);
    const gamesToCheck = gameMembers.slice(0, maxGamesToCheck);
    
    const gamesWithDates: Array<{ gameId: string; createdAt: number; isUserCreated: boolean }> = [];
    
    // Early exit: if we find 10 valid games, stop checking more
    const targetValidGames = 10;

    // Batch fetch all game data first to reduce round trips
    const gameIds = gamesToCheck.map((item: any) => typeof item === 'string' ? item : item.member);
    const gameDataPromises = gameIds.map((gameId: string) => 
      context.redis.hGetAll(`game:${gameId}`)
    );
    const allGameData = await Promise.all(gameDataPromises);

    // First pass: filter out games based on basic validation (no Redis calls)
    const validGameCandidates: Array<{ gameId: string; gameData: any; index: number }> = [];
    
    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];
      const gameData = allGameData[i];

      // Skip already excluded games
      if (allExcluded.includes(gameId)) {
        continue;
      }

      // Skip basic validation checks first (fast, no Redis)
      if (!gameData.redditPostId || !gameData.word) {
        continue;
      }

      const isRemoved = gameData.isRemoved === 'true';
      if (isRemoved) {
        continue;
      }

      let hasValidGifs = false;
      if (gameData?.gifs) {
        try {
          const gifs = JSON.parse(gameData.gifs);
          hasValidGifs = Array.isArray(gifs) && gifs.length > 0;
        } catch (e) {
          continue;
        }
      }

      if (!hasValidGifs) {
        continue;
      }

      // This game passed basic validation
      validGameCandidates.push({ gameId, gameData, index: i });
    }

    // Second pass: batch fetch game states for valid candidates (if user is logged in)
    let gameStates: any[] = [];
    if (resolvedUsername && validGameCandidates.length > 0) {
      const gameStatePromises = validGameCandidates.map(({ gameId }) =>
        context.redis.hGetAll(`gameState:${resolvedUsername}:${gameId}`)
      );
      gameStates = await Promise.all(gameStatePromises);
    }

    // Third pass: build final list of valid games
    for (let i = 0; i < validGameCandidates.length; i++) {
      // Stop if we already have enough valid games
      if (gamesWithDates.length >= targetValidGames) {
        break;
      }

      const { gameId, gameData } = validGameCandidates[i];
      
      // Check game state if available
      if (resolvedUsername && gameStates[i]) {
        const gameState = gameStates[i];
        if (gameState && gameState.playerState) {
          const parsedState = JSON.parse(gameState.playerState);
          if (
            parsedState.isCompleted || 
            parsedState.hasGivenUp || 
            parsedState.isCreator ||
            parsedState.gifHintCount >= 999
          ) {
            continue;
          }
        }
      }

      const createdAt = parseInt(gameData.createdAt || '0');

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

    gamesWithDates.sort((a, b) => b.createdAt - a.createdAt);
    const recentGames = gamesWithDates;
    
    if (recentGames.length === 0) {
      const totalGamesCount = gameMembers.length;
      const hasPlayedAllGames = resolvedUsername && completedGames.length > 0 && totalGamesCount > 0;
      
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
