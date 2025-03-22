import { Context, RichTextBuilder } from '@devvit/public-api';
import {
  GameRedisData,
  GameData,
  GetRecentGamesResponse,
  GetGameResponse,
  SaveGameResponse,
  GifCacheResponse,
  CreatorData,
} from '../lib/types';

export async function saveGame(params: CreatorData, context: Context): Promise<SaveGameResponse> {
  try {
    console.log('🔍 [DEBUG] saveGame called with params:', params);
    const { word, maskedWord, questionText, gifs, postToSubreddit = true } = params;

    // Get the current user information (if available)
    let username = 'Anonymous';
    let userId = 'anonymous';

    try {
      // Try to get the current user's information
      const currentUser = await context.reddit.getCurrentUser();
      if (currentUser) {
        // Reddit user IDs typically start with t2_
        userId = currentUser.id; // This will be in the format "t2_xyz123"
        username = currentUser.username;
        console.log('✅ [DEBUG] Found user:', { id: userId, username });
      }
    } catch (userError) {
      console.error('❌ [DEBUG] Error getting current user:', userError);
      // Continue with default anonymous values if there's an error
    }

    // Use provided values or generate defaults
    const finalMaskedWord = maskedWord || word.replace(/[a-zA-Z]/g, '_');
    const finalQuestionText = questionText || `Guess the word: ${finalMaskedWord}`;

    // Generate a unique game ID
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log('🔍 [DEBUG] Generated game ID:', gameId);

    // Save the game data as a hash (with proper user ID)
    await context.redis.hSet(`game:${gameId}`, {
      word,
      maskedWord: finalMaskedWord,
      questionText: finalQuestionText,
      gifs: JSON.stringify(gifs),
      createdAt: Date.now().toString(),
      creatorId: userId, // Store the full Reddit user ID (t2_xyz123)
      creatorUsername: username, // Store username for display
    });

    console.log('✅ [DEBUG] Game data saved to Redis hash with creator info:', userId, username);

    // Add to active games sorted set with timestamp as score
    await context.redis.zAdd('activeGames', {
      score: Date.now(),
      member: gameId,
    });

    // Add to user's games set if we have a valid userId (not anonymous)
    if (userId !== 'anonymous') {
      // Use the full Reddit user ID to create a user-specific key
      // Add a game to a user's list with timestamp as score
      await context.redis.zAdd(`user:${userId}:games`, { member: gameId, score: Date.now() });
      console.log("✅ [DEBUG] Game added to user\'s games set:", userId);
    }

    // Post to the PlayGIFEnigma subreddit if requested
    let postId = null;
    if (postToSubreddit) {
      try {
        // Create post title with attribution when possible
        const postTitle =
          userId !== 'anonymous'
            ? `GIF Enigma Challenge by u/${username}: ${finalMaskedWord}`
            : `GIF Enigma Challenge: ${finalMaskedWord}`;

        console.log('🔍 [DEBUG] Creating Reddit post with title:', postTitle);

        // Create rich text content with creator attribution
        const richtext = new RichTextBuilder()
          .heading({ level: 1 }, (h) => h.rawText('Can you solve this GIF Enigma?'))
          .heading({ level: 2 }, (h) => h.rawText(`Challenge: ${finalQuestionText}`))
          .heading({ level: 2 }, (h) => h.rawText(`Word to guess: ${finalMaskedWord}`))
          .paragraph((p) =>
            p.text({ text: 'This challenge contains 4 GIFs that hint at the solution.' })
          );

        // Add creator info if available
        if (userId !== 'anonymous') {
          richtext.paragraph((p) => p.text({ text: `Created by u/${username}` }));
        }

        // Add game ID and instructions
        richtext
          .paragraph((p) => p.text({ text: `Game ID: ${gameId}` }))
          .paragraph((p) =>
            p.text({
              text: 'Play the game by visiting our app or commenting with your guess below!',
            })
          );

        const post = await context.reddit.submitPost({
          subredditName: 'PlayGIFEnigma',
          title: postTitle,
          richtext: richtext,
        });

        if (post && post.id) {
          postId = post.id;
          console.log('✅ [DEBUG] Reddit post created with ID:', postId);

          // Store post ID with game data for reference
          await context.redis.hSet(`game:${gameId}`, { redditPostId: postId });
          console.log('✅ [DEBUG] Reddit post ID stored in Redis');

          // Add a comment with the GIFs for visibility
          try {
            const gifsCommentText = gifs
              .map((gif: any, index: number) => `**GIF ${index + 1}:** ${gif}`)
              .join('\n\n');
            await context.reddit.submitComment({
              id: postId,
              text: `## Game GIFs:\n\n${gifsCommentText}`,
            });
            console.log('✅ [DEBUG] Comment with GIFs added to Reddit post');
          } catch (commentError) {
            console.error('❌ [DEBUG] Error posting comment with GIFs:', commentError);
          }
        }
      } catch (postError) {
        console.error('❌ [DEBUG] Error posting to subreddit:', postError);
        // Don't fail the entire operation if posting to Reddit fails
      }
    }

    const result: SaveGameResponse = {
      success: true,
      gameId,
      postedToReddit: !!postId,
      redditPostId: postId || undefined,
    };

    console.log('✅ [DEBUG] saveGame returning result:', result);
    return result;
  } catch (error) {
    console.error('❌ [DEBUG] Error in saveGame:', error);
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

    // Check if activeGames exists using multiple methods
    try {
      // Check using zCard - this is the correct way to get the count of a sorted set
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
        limit: { offset: 0, count: limit }
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
              return scoreB - scoreA; // Descending order (newest first)
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
            creatorId: rawGameData.creatorId,
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

// Get a specific game by ID
export async function getGame(
  params: { gameId: string },
  context: Context
): Promise<GetGameResponse> {
  try {
    console.log('🔍 [DEBUG] getGame called with gameId:', params.gameId);
    const { gameId } = params;

    const rawGameData = (await context.redis.hGetAll(`game:${gameId}`)) as GameRedisData;
    console.log('🔍 [DEBUG] Raw game data:', rawGameData);

    if (!rawGameData || Object.keys(rawGameData).length === 0) {
      console.error('❌ [DEBUG] Game not found for ID:', gameId);
      return { success: false, error: 'Game not found' };
    }

    // Create a proper typed game data object
    const gameData: GameData = {
      id: gameId,
      word: rawGameData.word,
      maskedWord: rawGameData.maskedWord,
      questionText: rawGameData.questionText,
      gifs: [],
      createdAt: rawGameData.createdAt,
      creatorId: rawGameData.creatorId,
      redditPostId: rawGameData.redditPostId,
    };

    // Parse the gifs JSON string back to an array
    if (rawGameData.gifs) {
      try {
        // If gifs is already an array, use it; otherwise parse it
        if (Array.isArray(rawGameData.gifs)) {
          gameData.gifs = rawGameData.gifs;
        } else {
          gameData.gifs = JSON.parse(rawGameData.gifs as string);
        }
        console.log('✅ [DEBUG] Successfully parsed gifs:', gameData.gifs);
      } catch (parseError) {
        console.error('❌ [DEBUG] Error parsing gifs:', parseError);
        gameData.gifs = [];
      }
    } else {
      console.warn('⚠️ [DEBUG] No gifs field found in game data');
      gameData.gifs = [];
    }

    const result: GetGameResponse = {
      success: true,
      game: gameData,
    };

    console.log('✅ [DEBUG] getGame returning result:', result);
    return result;
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
    expirationDate.setSeconds(expirationDate.getSeconds() + 86400); // 24 hours in seconds

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
  params: { userId: string; limit?: number }, 
  context: Context
): Promise<GetRecentGamesResponse> {
  try {
    console.log('🔍 [DEBUG] getUserGames called for userId:', params.userId);
    const { userId, limit = 10 } = params;
    
    if (!userId) {
      return { 
        success: false, 
        error: 'User ID is required',
        games: [] 
      };
    }
    
    // Ensure we're using the full Reddit user ID format (t2_xyz123)
    const formattedUserId = userId.startsWith('t2_') ? userId : userId;
    console.log('🔍 [DEBUG] Looking up games for user ID:', formattedUserId);
    
    // Get game IDs from the user's games sorted set
    const gameItems = await context.redis.zRange(`user:${formattedUserId}:games`, 0, limit - 1, {
      reverse: true // Get most recent games first
      ,
      by: 'score'
    });
    
    const gameIds = gameItems.map(item => item.member);
    console.log(`🔍 [DEBUG] Found ${gameIds.length} games for user ${formattedUserId}:`, gameIds);
    
    if (!gameIds || gameIds.length === 0) {
      // If no games found with that ID, try to get user info and return helpful message
      let username = "this user";
      try {
        if (formattedUserId.startsWith('t2_')) {
          const user = await context.reddit.getUserById(formattedUserId);
          if (user) {
            username = `u/${user.username}`;
          }
        }
      } catch (userError) {
        console.error('❌ [DEBUG] Error fetching user details:', userError);
      }
      
      return { 
        success: true, 
        games: [],
        message: `No games found for ${username}`
      };
    }
    
    // Get game data for each ID
    const games: GameData[] = [];
    for (const gameId of gameIds) {
      try {
        const rawGameData = await context.redis.hGetAll(`game:${gameId}`);
        
        if (rawGameData && Object.keys(rawGameData).length > 0) {
          // Create a properly typed game data object
          const gameData: GameData = {
            id: gameId,
            word: rawGameData.word,
            maskedWord: rawGameData.maskedWord,
            questionText: rawGameData.questionText,
            gifs: [], // Will be filled below
            createdAt: rawGameData.createdAt,
            creatorId: rawGameData.creatorId,
            creatorUsername: rawGameData.creatorUsername,
            redditPostId: rawGameData.redditPostId
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
    
    // Try to get username if we have games but no username
    let username = games.length > 0 && games[0].creatorUsername 
      ? games[0].creatorUsername 
      : "this user";
    
    if (!username && formattedUserId.startsWith('t2_')) {
      try {
        const user = await context.reddit.getUserById(formattedUserId);
        if (user) {
          username = user.username;
        }
      } catch (userError) {
        console.error('❌ [DEBUG] Error fetching user details:', userError);
      }
    }
    
    return {
      success: true,
      games,
      message: `Found ${games.length} games for ${username}`
    };
  } catch (error) {
    console.error('❌ [DEBUG] Error in getUserGames:', error);
    return { 
      success: false, 
      error: String(error),
      games: [] 
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
