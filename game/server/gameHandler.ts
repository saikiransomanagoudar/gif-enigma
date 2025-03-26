import { Devvit, Context } from '@devvit/public-api';
import {
  GameData,
  GetRecentGamesResponse,
  GetGameResponse,
  SaveGameResponse,
  GifCacheResponse,
  CreatorData,
} from '../lib/types';

// Save a created game to Redis and create a Reddit post for it
// The postToSubreddit parameter defaults to true and controls if a Reddit post is created
export async function saveGame(params: CreatorData, context: Context): Promise<SaveGameResponse> {
  try {
    const { word, maskedWord, questionText, gifs, postToSubreddit = true } = params;
    const user = await context.reddit.getCurrentUser();
    const username = user?.username || 'anonymous';

    // Generate a unique game ID
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Use a transaction to ensure all operations succeed together
    const tx = await context.redis.watch('games');
    await tx.multi();

    // Save the game data as a hash
    await tx.hSet(`game:${gameId}`, {
      word,
      maskedWord: maskedWord || '', // Ensure non-null string
      questionText: questionText || '', // Ensure non-null string
      gifs: JSON.stringify(gifs),
      createdAt: Date.now().toString(),
      username,
    });

    // Add to active games sorted set with timestamp as score
    await tx.zAdd('activeGames', { score: Date.now(), member: gameId });

    // Execute all commands
    await tx.exec();

    // Post to the subreddit if requested
    let postId = null;
    if (postToSubreddit) {
      try {
        // Get current subreddit
        const subreddit = await context.reddit.getCurrentSubreddit();
        const subredditName = subreddit?.name || 'PlayGIFEnigma';

        // Create post title
        // const wordDisplay = maskedWord ? maskedWord.replace(/_/g, ' _') : '';
        const postTitle = `Can you decode the word or phrase hidden in this GIF?`;

        // Store game preview data for faster access (do this BEFORE creating post)
        await context.redis.hSet(`gamePreview:${gameId}`, {
          maskedWord: maskedWord || '',
          gifs: JSON.stringify(gifs),
        });

        const post = await context.reddit.submitPost({
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
              // Title
              Devvit.createElement(
                'vstack',
                {
                  alignment: 'center middle',
                  padding: 'medium',
                },
                [
                  Devvit.createElement(
                    'text',
                    {
                      color: '#FF4500',
                      size: 'xlarge',
                      weight: 'bold',
                    },
                    'GIF Enigma'
                  ),
                ]
              ),

              // Masked word display
              Devvit.createElement(
                'vstack',
                {
                  padding: 'medium',
                  alignment: 'center middle',
                },
                [
                  Devvit.createElement(
                    'text',
                    {
                      color: '#FFFFFF',
                      size: 'large',
                      weight: 'bold',
                    },
                    'Word to guess:'
                  ),

                  Devvit.createElement(
                    'text',
                    {
                      color: '#7fcfff',
                      size: 'xlarge',
                      weight: 'bold',
                    },
                    maskedWord || ''
                  ),
                ]
              ),

              // First GIF preview
              Devvit.createElement(
                'vstack',
                {
                  backgroundColor: '#1a2740',
                  cornerRadius: 'large',
                  padding: 'medium',
                  alignment: 'center middle',
                  width: '80%',
                },
                [
                  gifs && gifs.length > 0
                    ? Devvit.createElement('image', {
                        url: gifs[0],
                        imageWidth: 180,
                        imageHeight: 180,
                        resizeMode: 'fit',
                        description: 'First GIF clue',
                      })
                    : null,

                  Devvit.createElement(
                    'text',
                    {
                      color: '#FFFFFF',
                      size: 'xsmall',
                    },
                    '3 more clues await in the full game!'
                  ),
                ]
              ),

              // Play button
              Devvit.createElement(
                'vstack',
                {
                  padding: 'medium',
                  alignment: 'center middle',
                },
                [
                  Devvit.createElement(
                    'hstack',
                    {
                      backgroundColor: '#FF4500',
                      cornerRadius: 'full',
                      padding: 'medium',
                      alignment: 'center middle',
                    },
                    [
                      Devvit.createElement(
                        'text',
                        {
                          color: '#FFFFFF',
                          weight: 'bold',
                        },
                        'Solve It!'
                      ),
                    ]
                  ),
                ]
              ),
            ]
          ),
        });

        if (post && post.id) {
          postId = post.id;

          // Store post ID with game data for reference
          await context.redis.hSet(`game:${gameId}`, { redditPostId: postId });

          // Store the relationship between post and game
          await context.redis.hSet(`post:${postId}`, {
            gameId,
            created: Date.now().toString(),
          });

          // Update gamePreview with postId
          // await context.redis.hSet(`gamePreview:${gameId}`, { postId });

          console.log(
            `Successfully posted game ${gameId} to r/${subredditName} with post ID: ${postId}`
          );
        }
      } catch (postError) {
        console.error('Error posting to subreddit:', postError);
        // Don't fail the entire operation if posting to Reddit fails
      }
    }

    return {
      success: true,
      gameId,
      postedToReddit: !!postId,
      redditPostId: postId || undefined,
    };
  } catch (error) {
    console.error('Error saving game:', error);
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
