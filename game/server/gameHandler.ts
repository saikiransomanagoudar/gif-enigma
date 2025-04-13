import { Devvit, Context } from '@devvit/public-api';
import {
  GameData,
  GetRecentGamesResponse,
  GetGameResponse,
  SaveGameResponse,
  GifCacheResponse,
  CreatorData,
  PostCommentResponse,
  PlayerGameState,
} from '../lib/types';

export async function saveGame(params: CreatorData, context: Context): Promise<SaveGameResponse> {
  try {
    const {
      word,
      maskedWord,
      category,
      questionText,
      gifs,
      postToSubreddit = true,
      isChatPost = false,
    } = params;
    console.log('🔍 [DEBUG] Creating game with category:', category);
    const user = await context.reddit.getCurrentUser();
    const username = user?.username || 'anonymous';

    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const tx = await context.redis.watch('games');
    await tx.multi();

    await tx.hSet(`game:${gameId}`, {
      word,
      category: category || 'General',
      maskedWord: maskedWord || '',
      questionText: questionText || '',
      gifs: JSON.stringify(gifs),
      createdAt: Date.now().toString(),
      username,
    });

    await tx.zAdd('activeGames', { score: Date.now(), member: gameId });
    await tx.exec();

    let postId = null;
    if (postToSubreddit) {
      const subreddit = await context.reddit.getCurrentSubreddit();
      const subredditName = subreddit?.name || 'PlayGIFEnigma';
      const allowChatPostCreation = await context.settings.get('allowChatPostCreation');

      const postTitle = `Can you decode the word or phrase hidden in this GIF?`;

      const finalIsChatPost = allowChatPostCreation === false ? false : isChatPost;
      await context.redis.hSet(`gamePreview:${gameId}`, {
        maskedWord: maskedWord || '',
        gifs: JSON.stringify(gifs),
        creatorUsername: username,
        isChatPost: finalIsChatPost ? 'true' : 'false',
      });

      const postOptions: any = {
        subredditName: subredditName,
        title: postTitle,
        preview: Devvit.createElement(
          'vstack',
          {
            alignment: 'center middle',
            height: '100%',
            width: '100%',
            backgroundColor: '#0d1629',
          },
          [
            Devvit.createElement('image', {
              url: 'eyebrows.gif',
              imageWidth: 180,
              imageHeight: 180,
              resizeMode: 'fit',
              description: 'Loading game...',
            }),
          ]
        ),
      };

      const post = await context.reddit.submitPost(postOptions);

      if (post && post.id) {
        postId = post.id;

        await context.redis.hSet(`game:${gameId}`, {
          redditPostId: postId,
          isChatPost: finalIsChatPost ? 'true' : 'false',
        });

        await context.redis.hSet(`post:${postId}`, {
          gameId,
          created: Date.now().toString(),
          isChatPost: finalIsChatPost ? 'true' : 'false',
        });
      }
    }

    return {
      success: true,
      gameId,
      postedToReddit: !!postId,
      redditPostId: postId || undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function postCompletionComment(
  params: {
    gameId: string;
    username: string;
    numGuesses: number;
    gifHints: number;
    wordHints: number;
    hintTypeLabel: string;
    redditPostId?: string;
  },
  context: Context
): Promise<PostCommentResponse> {
  try {
    console.log('🎉 [DEBUG] postCompletion Comment called with params:', JSON.stringify(params));
    const { gameId, username, numGuesses, gifHints, wordHints, hintTypeLabel, redditPostId } =
      params;

    // First, check if a comment has already been posted for this user on this game
    const commentKey = `comment:${gameId}:${username}`;
    const existingComment = await context.redis.get(commentKey);

    if (existingComment) {
      console.log(`🔁 [DEBUG] Comment already posted for ${username} on game ${gameId}`);
      return { success: true, alreadyPosted: true };
    }

    // Get the Reddit post ID if not provided
    let postId = redditPostId;
    if (!postId) {
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      postId = gameData.redditPostId;
    }

    if (!postId) {
      console.error(`❌ [DEBUG] No Reddit post ID found for game ${gameId}`);
      return { success: false, error: 'No Reddit post ID found for this game' };
    }

    // Create the completion message with improved hint text formatting
    let hintsDescription = 'no hints';

    // Only override the default text if there are actual hints
    if (gifHints > 0 || wordHints > 0) {
      const hintParts = [];

      if (gifHints > 0) {
        hintParts.push(`${gifHints} GIF hint${gifHints !== 1 ? 's' : ''}`);
      }

      if (wordHints > 0) {
        hintParts.push(`${wordHints} ${hintTypeLabel} hint${wordHints !== 1 ? 's' : ''}`);
      }

      hintsDescription = hintParts.join(' and ');
    }

    // Build the final comment text
    let completionText = '';

    if (numGuesses === 1) {
      completionText = `I cracked it on my **first attempt** with **${hintsDescription}**!`;
    } else {
      completionText = `I cracked it in **${numGuesses} attempts** with **${hintsDescription}**!`;
    }

    console.log(`📝 [DEBUG] Comment to post: "${completionText}"`);

    try {
      // Post the comment
      const comment = await context.reddit.submitComment({
        id: postId,
        text: completionText,
      });

      console.log(`✅ [DEBUG] Comment posted successfully:`, comment);

      // Store the comment record to prevent duplicates
      await context.redis.set(commentKey, 'posted', {
        expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
      });

      console.log(
        `✅ [DEBUG] Successfully posted completion comment for ${username} on game ${gameId}`
      );
      return { success: true };
    } catch (commentError) {
      console.error(`❌ [DEBUG] Error posting comment: ${commentError}`);
      return { success: false, error: String(commentError) };
    }
  } catch (error) {
    console.error(`❌ [DEBUG] Error in postCompletionComment: ${error}`);
    return { success: false, error: String(error) };
  }
}

// Get recent games
export async function getRecentGames(
  params: { limit?: number },
  context: Context
): Promise<GetRecentGamesResponse> {
  try {
    console.log('🔍 [DEBUG] getRecentGames called with params:', params);
    const { limit = 5 } = params;
    console.log('🔍 [DEBUG] Using limit:', limit);

    // Test Redis connection
    try {
      await context.redis.set('test_key', 'test_value');
      const testValue = await context.redis.get('test_key');
      console.log('✅ [DEBUG] Redis test successful. test_key value:', testValue);
    } catch (redisError) {
      console.error('❌ [DEBUG] Redis test failed:', redisError);
      return { success: false, error: `Redis connection error: ${String(redisError)}` };
    }

    try {
      const activeGamesCount = await context.redis.zCard('activeGames');
      console.log(`🔍 [DEBUG] activeGames count from zCard: ${activeGamesCount}`);

      // Try to get game keys directly (not activeGames keys)
      try {
        const keys = await context.redis.hKeys('game:*');
        console.log('🔍 [DEBUG] Game hash keys:', keys);
      } catch (keysError) {
        console.error('❌ [DEBUG] Error getting keys:', keysError);
      }
    } catch (checkError) {
      console.error('❌ [DEBUG] Error checking activeGames:', checkError);
    }

    // Get game IDs from the sorted set - this is the proper way to get members from a sorted set
    console.log('🔍 [DEBUG] Fetching game IDs using zRange...');
    let gameIds: string[] = [];

    try {
      // Use zRange with parameters to get most recent games first
      const scoreMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
        by: 'score',
        reverse: true,
        limit: { offset: 0, count: limit },
      });

      console.log('🔍 [DEBUG] zRange with by:score result:', scoreMembers);

      if (scoreMembers && scoreMembers.length > 0) {
        gameIds = scoreMembers.map((item) => (typeof item === 'string' ? item : item.member));
        console.log('🔍 [DEBUG] Extracted game IDs with by:score:', gameIds);
      }
    } catch (scoreError) {
      console.error('❌ [DEBUG] Error with zRange by:score:', scoreError);

      // Fallback to simpler zRange if the complex one fails
      try {
        console.log('🔍 [DEBUG] Trying simplified zRange approach...');
        const allMembers = await context.redis.zRange('activeGames', 0, -1);
        console.log('🔍 [DEBUG] Simple zRange result:', allMembers);

        if (allMembers && allMembers.length > 0) {
          // Extract just the game IDs (members)
          gameIds = allMembers.map((item) => (typeof item === 'string' ? item : item.member));
          console.log('🔍 [DEBUG] Extracted game IDs:', gameIds);

          // Sort by score (newest first) if we have scores
          // This is a manual fallback if the sorted zRange fails
          if (allMembers[0] && typeof allMembers[0] !== 'string' && 'score' in allMembers[0]) {
            allMembers.sort((a, b) => {
              const scoreA = typeof a === 'string' ? 0 : a.score;
              const scoreB = typeof b === 'string' ? 0 : b.score;
              return scoreB - scoreA;
            });

            // Re-extract after sorting
            gameIds = allMembers.map((item) => (typeof item === 'string' ? item : item.member));
          }

          // Limit the results
          gameIds = gameIds.slice(0, limit);
        }
      } catch (zrangeError) {
        console.error('❌ [DEBUG] Error with simple zRange:', zrangeError);
      }
    }

    // If we still have no games, return error
    if (gameIds.length === 0) {
      console.error('❌ [DEBUG] Could not retrieve any games from activeGames');
      return {
        success: false,
        error: 'No games found or could not access the games database',
        games: [],
      };
    }

    console.log(`🔍 [DEBUG] Using ${gameIds.length} game IDs:`, gameIds);

    // Process each game ID to get the game data
    const games: GameData[] = [];
    for (const gameId of gameIds) {
      console.log(`🔍 [DEBUG] Fetching data for game: ${gameId}`);

      try {
        const rawGameData = await context.redis.hGetAll(`game:${gameId}`);
        console.log(`🔍 [DEBUG] Raw game data for ${gameId}:`, rawGameData);

        if (rawGameData && Object.keys(rawGameData).length > 0) {
          // Create a properly typed game data object
          const gameData: GameData = {
            id: gameId,
            word: rawGameData.word,
            maskedWord: rawGameData.maskedWord,
            category: rawGameData.category || 'General',
            questionText: rawGameData.questionText,
            gifs: [],
            createdAt: rawGameData.createdAt,
            username: rawGameData.username,
            redditPostId: rawGameData.redditPostId,
          };

          // Parse the gifs JSON string back to an array
          if (rawGameData.gifs) {
            try {
              // If gifs is already an array, use it; otherwise parse it
              if (Array.isArray(rawGameData.gifs)) {
                gameData.gifs = rawGameData.gifs;
              } else {
                gameData.gifs = JSON.parse(rawGameData.gifs);
              }
              console.log(`✅ [DEBUG] Successfully parsed gifs for game ${gameId}:`, gameData.gifs);
            } catch (parseError) {
              console.error(`❌ [DEBUG] Error parsing gifs for game ${gameId}:`, parseError);
              gameData.gifs = [];
            }
          } else {
            console.warn(`⚠️ [DEBUG] No gifs field found for game ${gameId}`);
            gameData.gifs = [];
          }

          games.push(gameData);
          console.log(`✅ [DEBUG] Successfully processed game ${gameId}`);
        } else {
          console.error(`❌ [DEBUG] Game data not found for gameId: ${gameId}`);
        }
      } catch (gameError) {
        console.error(`❌ [DEBUG] Error processing game ${gameId}:`, gameError);
      }
    }

    // Return the results
    const result: GetRecentGamesResponse = {
      success: games.length > 0,
      games,
      debug: {
        gamesFound: games.length,
        activeGamesTotal: gameIds.length,
      },
    };

    if (games.length === 0) {
      result.error = 'No valid games could be processed';
    }

    console.log('✅ [DEBUG] getRecentGames returning result:', result);
    return result;
  } catch (error) {
    console.error('❌ [DEBUG] Error in getRecentGames:', error);
    return { success: false, error: String(error), games: [] };
  }
}

export async function getGame(
  params: { gameId: string },
  context: Context
): Promise<GetGameResponse> {
  try {
    const { gameId } = params;
    console.log('🔍 [DEBUG] getGame called with gameId:', gameId);

    // 1. Check both registry and activeGames
    const [existsInRegistry, score] = await Promise.all([
      context.redis.exists('game_registry', gameId),
      context.redis.zScore('activeGames', gameId),
    ]);

    if (!existsInRegistry && !score) {
      console.error('❌ [DEBUG] Game not found in any registry:', gameId);
      return { success: false, error: 'Game not found' };
    }

    // 2. Get game data
    const rawGameData = await context.redis.hGetAll(`game:${gameId}`);
    if (!rawGameData?.word) {
      console.error('❌ [DEBUG] Corrupted game data for:', gameId);
      return { success: false, error: 'Corrupted game data' };
    }

    console.log('🔍 [DEBUG] Raw game data category:', rawGameData.category);

    // 3. Parse and validate
    const gameData: GameData = {
      id: gameId,
      word: rawGameData.word,
      maskedWord: rawGameData.maskedWord,
      questionText: rawGameData.questionText,
      gifs: [],
      createdAt: rawGameData.createdAt,
      username: rawGameData.username,
      redditPostId: rawGameData.redditPostId,
      category: rawGameData.category || 'General',
    };

    // 4. Process GIFs
    try {
      gameData.gifs = JSON.parse(rawGameData.gifs || '[]');

      // Validate URLs
      gameData.gifs = gameData.gifs.filter(
        (url) =>
          url.startsWith('https://i.redd.it/') ||
          url.startsWith('https://reddit.com/media') ||
          url.includes('redd.it') ||
          url.includes('reddit.com')
      );
    } catch (error) {
      console.error('❌ [DEBUG] GIF parsing failed for:', gameId);
      return { success: false, error: 'Invalid GIF data' };
    }

    // 5. Add username if missing
    if (gameData.username?.startsWith('t2_')) {
      try {
        const user = await context.reddit.getUserByUsername(gameData.username);
        if (user) {
          await context.redis.hSet(`game:${gameId}`, {
            username: user.username,
          });
        }
      } catch (userError) {
        console.error('❌ [DEBUG] User lookup failed:', userError);
      }
    }

    console.log('✅ [DEBUG] Successfully retrieved game:', gameId);
    return { success: true, game: gameData };
  } catch (error) {
    console.error('❌ [DEBUG] Error in getGame:', error);
    return { success: false, error: String(error) };
  }
}

// Check if a user has completed a game
export async function hasUserCompletedGame(
  params: { gameId: string; username: string },
  context: Context
): Promise<{ completed: boolean }> {
  try {
    const { gameId, username } = params;
    console.log(`🔍 [DEBUG] Checking if user ${username} has completed game ${gameId}`);

    if (!username || !gameId) {
      return { completed: false };
    }

    // Check if the game is in the user's completed games set
    const score = await context.redis.zScore(`user:${username}:completedGames`, gameId);

    // FIXED: Only consider completed if score is not null and not undefined
    const completed = score !== null && score !== undefined;

    console.log(
      `✅ [DEBUG] User ${username} has ${completed ? 'completed' : 'not completed'} game ${gameId}, score: ${score}`
    );
    return { completed };
  } catch (error) {
    console.error(`❌ [DEBUG] Error checking game completion status: ${error}`);
    return { completed: false };
  }
}

// Cache GIF search results
export async function cacheGifResults(
  params: { query: string; results: any[] },
  context: Context
): Promise<GifCacheResponse> {
  try {
    console.log('🔍 [DEBUG] cacheGifResults called with query:', params.query);
    const { query, results } = params;

    if (!query || !results || !Array.isArray(results)) {
      console.error('❌ [DEBUG] Invalid parameters for cacheGifResults');
      return { success: false, error: 'Invalid parameters' };
    }

    // Cache the results for 24 hours
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + 86400);

    await context.redis.set(`gifSearch:${query.toLowerCase()}`, JSON.stringify(results), {
      expiration: expirationDate,
    });

    console.log('✅ [DEBUG] Successfully cached GIF results for query:', query);
    return { success: true };
  } catch (error) {
    console.error('❌ [DEBUG] Error in cacheGifResults:', error);
    return { success: false, error: String(error) };
  }
}

// Get games created by a specific user
export async function getUserGames(
  params: { username: string; limit?: number },
  context: Context
): Promise<GetRecentGamesResponse> {
  try {
    console.log('🔍 [DEBUG] getUserGames called for username:', params.username);
    const { username, limit = 10 } = params;

    if (!username) {
      return {
        success: false,
        error: 'Username is required',
        games: [],
      };
    }

    // Get game IDs from the user's games sorted set using username
    const gameItems = await context.redis.zRange(`user:${username}:games`, 0, limit - 1, {
      reverse: true, // Get most recent games first
      by: 'score',
    });

    const gameIds = gameItems.map((item) => item.member);
    console.log(`🔍 [DEBUG] Found ${gameIds.length} games for user ${username}:`, gameIds);

    if (!gameIds || gameIds.length === 0) {
      return {
        success: true,
        games: [],
        message: `No games found for u/${username}`,
      };
    }

    // Get game data for each ID
    const games: GameData[] = [];
    for (const gameId of gameIds) {
      try {
        const rawGameData = await context.redis.hGetAll(`game:${gameId}`);

        if (rawGameData && Object.keys(rawGameData).length > 0) {
          const gameData: GameData = {
            id: gameId,
            word: rawGameData.word,
            maskedWord: rawGameData.maskedWord,
            questionText: rawGameData.questionText,
            gifs: [], // Will be filled below
            createdAt: rawGameData.createdAt,
            username: rawGameData.username,
            redditPostId: rawGameData.redditPostId,
          };

          // Parse the gifs JSON string
          if (rawGameData.gifs) {
            try {
              gameData.gifs = JSON.parse(rawGameData.gifs);
            } catch (parseError) {
              console.error(`❌ [DEBUG] Error parsing gifs for game ${gameId}:`, parseError);
              gameData.gifs = [];
            }
          }

          games.push(gameData);
        }
      } catch (gameError) {
        console.error(`❌ [DEBUG] Error fetching game ${gameId}:`, gameError);
      }
    }

    return {
      success: true,
      games,
      message: `Found ${games.length} games created by ${username}`,
    };
  } catch (error) {
    console.error('❌ [DEBUG] Error in getUserGames:', error);
    return {
      success: false,
      error: String(error),
      games: [],
    };
  }
}

// Get cached GIF search results
export async function getCachedGifResults(
  params: { query: string },
  context: Context
): Promise<GifCacheResponse> {
  try {
    console.log('🔍 [DEBUG] getCachedGifResults called with query:', params.query);
    const { query } = params;

    if (!query) {
      console.error('❌ [DEBUG] Invalid query parameter');
      return { success: false, error: 'Invalid query' };
    }

    const cachedResults = await context.redis.get(`gifSearch:${query.toLowerCase()}`);

    if (!cachedResults) {
      console.log('ℹ️ [DEBUG] No cached results found for query:', query);
      return { success: false, cached: false };
    }

    console.log('✅ [DEBUG] Retrieved cached results for query:', query);
    return { success: true, cached: true, results: JSON.parse(cachedResults) };
  } catch (error) {
    console.error('❌ [DEBUG] Error in getCachedGifResults:', error);
    return { success: false, error: String(error) };
  }
}

export async function saveGameState(
  params: {
    username: string;
    gameId: string;
    playerState: PlayerGameState;
  },
  context: Context
) {
  try {
    console.log('Saving game state:', params);
    const { username, gameId, playerState } = params;

    if (!username || !gameId || !playerState) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Create a key for this user's state for this specific game
    const gameStateKey = `gameState:${gameId}:${username}`;

    // Store the player state as a JSON string
    await context.redis.hSet(gameStateKey, {
      playerState: JSON.stringify(playerState),
      lastUpdated: Date.now().toString(),
    });

    // Set an expiration on the game state (30 days)
    await context.redis.expire(gameStateKey, 30 * 24 * 60 * 60);

    // If the game is completed, add it to the user's completed games set
    if (playerState.isCompleted) {
      console.log(`Adding game ${gameId} to ${username}'s completed games`);
      await context.redis.zAdd(`user:${username}:completedGames`, {
        member: gameId,
        score: Date.now(), // Using timestamp as score for sorting
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving game state:', error);
    return { success: false, error: String(error) };
  }
}

export async function getGameState(
  params: {
    username: string;
    gameId: string;
  },
  context: Context
) {
  try {
    console.log('Getting game state for:', params);
    const { username, gameId } = params;

    if (!username || !gameId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const gameStateKey = `gameState:${gameId}:${username}`;
    const gameState = await context.redis.hGetAll(gameStateKey);

    if (!gameState || Object.keys(gameState).length === 0) {
      // No saved state found
      return {
        success: false,
        error: 'Game state not found',
        // Return default initial state
        state: {
          playerState: {
            gifHintCount: 0,
            revealedLetters: [],
            guess: '',
            lastPlayed: Date.now(),
            isCompleted: false,
          },
          lastUpdated: Date.now().toString(),
        },
      };
    }

    // Parse the player state from JSON
    try {
      if (gameState.playerState) {
        gameState.playerState = JSON.parse(gameState.playerState);
      }
    } catch (e) {
      console.error('Error parsing playerState JSON:', e);
      gameState.playerState = JSON.stringify({
        gifHintCount: 0,
        revealedLetters: [],
        guess: '',
        lastPlayed: Date.now(),
        isCompleted: false,
      });
    }

    return { success: true, state: gameState };
  } catch (error) {
    console.error('Error getting game state:', error);
    return { success: false, error: String(error) };
  }
}

export async function getUnplayedGames(
  params: {
    username: string;
    limit?: number;
  },
  context: Context
) {
  try {
    const { username, limit = 10 } = params;

    if (!username) {
      return { success: false, error: 'Username is required' };
    }

    // Get the user's completed games
    const completedGames = await context.redis.zRange(`user:${username}:completedGames`, 0, -1, {
      by: 'score',
    });

    const completedGameIds = completedGames.map((game) =>
      typeof game === 'string' ? game : game.member
    );

    // Get all active games
    const allGames = await context.redis.zRange('activeGames', 0, -1, {
      by: 'score',
      reverse: true, // Get newest first
    });

    // Filter out games the user has already completed
    const unplayedGames = [];
    for (const game of allGames) {
      const gameId = typeof game === 'string' ? game : game.member;

      if (!completedGameIds.includes(gameId)) {
        const gameData = await context.redis.hGetAll(`game:${gameId}`);

        if (gameData && Object.keys(gameData).length > 0) {
          // Parse the gifs JSON string back to an array
          if (gameData.gifs) {
            gameData.gifs = JSON.parse(gameData.gifs);
          }

          unplayedGames.push({ id: gameId, ...gameData });

          // Stop if we've reached the limit
          if (unplayedGames.length >= limit) {
            break;
          }
        }
      }
    }

    return { success: true, games: unplayedGames };
  } catch (error) {
    console.error('Error getting unplayed games:', error);
    return { success: false, error: String(error) };
  }
}
