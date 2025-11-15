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
  params: { excludeIds?: string[]; preferUserCreated?: boolean; username?: string; useStickyNavigation?: boolean },
  context: any
) {
  try {
    const { excludeIds = [], preferUserCreated = true, username, useStickyNavigation = false } = params;
    
    let resolvedUsername: string | null = null;
    const incoming = String(username || '').trim();
    if (incoming && incoming.toLowerCase() !== 'anonymous') {
      resolvedUsername = incoming.replace(/^u\//i, '');
    } else {
      const fetched = await context.reddit.getCurrentUsername();
      if (fetched) resolvedUsername = fetched;
    }
    
    // Helper function to check if a game has been completed by the user
    const isGameCompleted = async (gameId: string): Promise<boolean> => {
      if (!resolvedUsername) return false;
      
      // Check 1: completedGames sorted set
      const completedGamesResult = await context.redis.zRange(
        `user:${resolvedUsername}:completedGames`, 
        0, 
        -1, 
        { by: 'score' }
      );
      
      const completedGameIds = completedGamesResult.map((item: any) =>
        typeof item === 'string' ? item : item.member
      );
      
      if (completedGameIds.includes(gameId)) {
        return true;
      }
      
      // Check 2: gameState for completion flags
      const gameState = await context.redis.hGetAll(`gameState:${resolvedUsername}:${gameId}`);
      
      if (gameState && gameState.playerState) {
        try {
          const parsedState = JSON.parse(gameState.playerState);
          
          if (parsedState.isCompleted || parsedState.hasGivenUp || parsedState.isCreator) {
            return true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Check 3: Look for a saved score (legacy completions before tracking was added)
      const scoreData = await context.redis.hGetAll(`score:${gameId}:${resolvedUsername}`);
      if (scoreData && Object.keys(scoreData).length > 0) {
        // Add to completedGames list for future checks
        await context.redis.zAdd(`user:${resolvedUsername}:completedGames`, {
          member: gameId,
          score: Date.now(),
        });
        return true;
      }
      
      return false;
    };
    
    // STICKY NAVIGATION: Check if user has an assigned game
    if (useStickyNavigation && resolvedUsername) {
      const assignedGameKey = `user:${resolvedUsername}:assignedGame`;
      const assignedGameId = await context.redis.get(assignedGameKey);
      
      if (assignedGameId) {
        // Check if user has already completed this game
        const isCompleted = await isGameCompleted(assignedGameId);
        
        if (isCompleted) {
          // User completed the assigned game - clear it
          await context.redis.del(assignedGameKey);
        } else {
          // Check if game is still valid
          const gameData = await context.redis.hGetAll(`game:${assignedGameId}`);
          
          if (gameData && gameData.redditPostId && gameData.word && gameData.gifs && gameData.isRemoved !== 'true') {
            try {
              const gifs = JSON.parse(gameData.gifs);
              if (Array.isArray(gifs) && gifs.length > 0) {
                // Verify Reddit post still exists and isn't removed
                try {
                  const post = await context.reddit.getPostById(gameData.redditPostId);
                  
                  if (post && !post.removed) {
                    // Game is still valid! Return it
                    const gameResult = await getGame({ gameId: assignedGameId }, context);
                    return gameResult;
                  } else {
                    // Post was removed - mark game and clear assignment
                    await context.redis.hSet(`game:${assignedGameId}`, { isRemoved: 'true' });
                    await context.redis.del(assignedGameKey);
                  }
                } catch (postError) {
                  // Error fetching post - clear assignment
                  await context.redis.del(assignedGameKey);
                }
              }
            } catch (e) {
              // Invalid GIFs - clear assignment
              await context.redis.del(assignedGameKey);
            }
          } else {
            // Invalid game data - clear assignment
            await context.redis.del(assignedGameKey);
          }
        }
      }
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
    
    // Fallback: If Redis is empty, try to find games from Reddit posts
    if (!gameMembers || gameMembers.length === 0) {
      const subreddit = await context.reddit.getCurrentSubreddit();
      const listing = await context.reddit.getNewPosts({
        subredditName: subreddit.name,
        limit: 100,
        pageSize: 100,
      });
      const posts = await listing.all();
      
      // Build game list from posts
      const gameIds = [];
      for (const post of posts) {
        const postData = await context.redis.hGetAll(`post:${post.id}`);
        if (postData && postData.gameId) {
          gameIds.push(postData.gameId);
        }
      }
      
      if (gameIds.length === 0) {
        return {
          success: false,
          error: 'No games available yet. Be the first to create one!',
          requestedUserCreated: preferUserCreated,
          hasPlayedAll: false,
        };
      }
      
      gameMembers.push(...gameIds.map(id => ({ member: id, score: 0 })));
    }
    
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
    const validGameCandidates: Array<{ gameId: string; gameData: any; index: number }> = [];
    
    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];
      const gameData = allGameData[i];

      if (allExcluded.includes(gameId)) {
        continue;
      }

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

    // Third pass: build final list of valid games with thorough completion checks
    for (let i = 0; i < validGameCandidates.length; i++) {
      // Stop if we already have enough valid games
      if (gamesWithDates.length >= targetValidGames) {
        break;
      }

      const { gameId, gameData } = validGameCandidates[i];
      
      // Use thorough completion check
      if (resolvedUsername) {
        const isCompleted = await isGameCompleted(gameId);
        if (isCompleted) {
          continue;
        }
      }
      
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

    // Try up to 20 games to find a valid one with existing Reddit post
    const MAX_ATTEMPTS = Math.min(20, candidatePool.length);
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const randomIndex = Math.floor(Math.random() * candidatePool.length);
      const selectedGame = candidatePool[randomIndex];
      const randomGameId = selectedGame.gameId;
      
      // Fetch the full game data
      const gameData = await context.redis.hGetAll(`game:${randomGameId}`);
      
      if (!gameData || !gameData.redditPostId || gameData.isRemoved === 'true') {
        // Remove from pool and try again
        candidatePool.splice(randomIndex, 1);
        if (candidatePool.length === 0) break;
        continue;
      }
      
      // Verify the Reddit post still exists and isn't removed
      try {
        const post = await context.reddit.getPostById(gameData.redditPostId);
        
        if (post && !post.removed) {
          // Valid game found! Store as assigned game if using sticky navigation
          if (useStickyNavigation && resolvedUsername) {
            const assignedGameKey = `user:${resolvedUsername}:assignedGame`;
            await context.redis.set(assignedGameKey, randomGameId);
          }
          
          const gameResult = await getGame({ gameId: randomGameId }, context);
          return gameResult;
        } else {
          // Post was removed - mark the game
          await context.redis.hSet(`game:${randomGameId}`, { isRemoved: 'true' });
          candidatePool.splice(randomIndex, 1);
          if (candidatePool.length === 0) break;
          continue;
        }
      } catch (error) {
        // Error fetching post - mark as removed and try another
        await context.redis.hSet(`game:${randomGameId}`, { isRemoved: 'true' });
        candidatePool.splice(randomIndex, 1);
        if (candidatePool.length === 0) break;
        continue;
      }
    }
    
    // Couldn't find a valid game after attempts
    return {
      success: false,
      error: 'Could not find a valid game. Please try again or create a new one!',
      requestedUserCreated: preferUserCreated,
      hasPlayedAll: false,
    };
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
      'AutoModerator',
      'reddit',
      'Most-Client-2219',
      'Mother_Play_6128',
      'Away-Airport-7318',
      'Beginner_Party_6899',
      'steve-sid',
      'seamless_ghost',
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
