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
  GetGameStatisticsResponse,
  GuessData,
} from '../lib/types';
import { awardCreationBonus } from './scoringService';

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
      inputType = 'word',
    } = params;
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

      const postTitle = `Can you decode the ${inputType} from this GIF?`;

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
            gap: 'none',
          },
          [
            Devvit.createElement('image', {
              url: 'eyebrows.gif',
              imageWidth: 180,
              imageHeight: 180,
              resizeMode: 'fit',
            }),
            Devvit.createElement('spacer', { size: 'small' }),
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

    // Award creation bonus XP to the creator
    await awardCreationBonus(username, context);

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
    redditPostId?: string;
  },
  context: Context
): Promise<PostCommentResponse> {
  try {
    const { gameId, username, numGuesses, gifHints, redditPostId } = params;

    // First, check if a comment has already been posted for this user on this game
    const commentKey = `comment:${gameId}:${username}`;
    const existingComment = await context.redis.get(commentKey);

    if (existingComment) {
      return { success: true, alreadyPosted: true };
    }

    // Get the Reddit post ID if not provided
    let postId = redditPostId;
    if (!postId) {
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      postId = gameData.redditPostId;
    }

    if (!postId) {
      return { success: false, error: 'No Reddit post ID found for this game' };
    }

    // Create the completion message with GIF hints only
    let hintsDescription = 'no hints';

    // Only show GIF hints in the comment
    if (gifHints > 0) {
      hintsDescription = `${gifHints} extra GIF hint${gifHints !== 1 ? 's' : ''}`;
    }

    // Build the final comment text
    let completionText = '';

    if (numGuesses === 1) {
      completionText = `I cracked it on my **first attempt** with **${hintsDescription}**! 🎉`;
    } else {
      completionText = `I cracked it in **${numGuesses} attempts** with **${hintsDescription}**.`;
    }

    try {
      await context.redis.set(commentKey, 'posted', {
        expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
      });

      return { success: true };
    } catch (commentError) {
      return { success: false, error: String(commentError) };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get recent games
export async function getRecentGames(
  params: { limit?: number },
  context: Context
): Promise<GetRecentGamesResponse> {
  try {
    const { limit = 5 } = params;
    let gameIds: string[] = [];

    try {
      // Use zRange with parameters to get most recent games first
      const scoreMembers = await context.redis.zRange('activeGames', '-inf', '+inf', {
        by: 'score',
        reverse: true,
        limit: { offset: 0, count: limit },
      });

      if (scoreMembers && scoreMembers.length > 0) {
        gameIds = scoreMembers.map((item) => (typeof item === 'string' ? item : item.member));
      }
    } catch (scoreError) {
      // Fallback to simpler zRange if the complex one fails
      const allMembers = await context.redis.zRange('activeGames', 0, -1);

      if (allMembers && allMembers.length > 0) {
        // Extract just the game IDs (members)
        gameIds = allMembers.map((item) => (typeof item === 'string' ? item : item.member));

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
    }

    // If we still have no games, return error
    if (gameIds.length === 0) {
      return {
        success: false,
        error: 'No games found or could not access the games database',
        games: [],
      };
    }
    // Process each game ID to get the game data
    const games: GameData[] = [];
    for (const gameId of gameIds) {
      const rawGameData = await context.redis.hGetAll(`game:${gameId}`);
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
          } catch (parseError) {
            gameData.gifs = [];
          }
        } else {
          gameData.gifs = [];
        }

        games.push(gameData);
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
    return result;
  } catch (error) {
    return { success: false, error: String(error), games: [] };
  }
}

export async function getGame(
  params: { gameId: string },
  context: Context
): Promise<GetGameResponse> {
  try {
    const { gameId } = params;

    // 1. Check both registry and activeGames
    const [existsInRegistry, score] = await Promise.all([
      context.redis.exists('game_registry', gameId),
      context.redis.zScore('activeGames', gameId),
    ]);

    if (!existsInRegistry && !score) {
      return { success: false, error: 'Game not found' };
    }

    // 2. Get game data
    const rawGameData = await context.redis.hGetAll(`game:${gameId}`);
    if (!rawGameData?.word) {
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
      return { success: false, error: 'Invalid GIF data' };
    }

    // 5. Add username if missing
    if (gameData.username?.startsWith('t2_')) {
      const user = await context.reddit.getUserByUsername(gameData.username);
      if (user) {
        await context.redis.hSet(`game:${gameId}`, {
          username: user.username,
        });
      }
    }

    return { success: true, game: gameData };
  } catch (error) {
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
    if (!username || !gameId) {
      return { completed: false };
    }

    // Check if the game is in the user's completed games set
    const completedGamesKey = `user:${username}:completedGames`;
    const score = await context.redis.zScore(completedGamesKey, gameId);

    const completed = score !== null && score !== undefined;
    return { completed };
  } catch (error) {
    return { completed: false };
  }
}

// Cache GIF search results
export async function cacheGifResults(
  params: { query: string; results: any[] },
  context: Context
): Promise<GifCacheResponse> {
  try {
    const { query, results } = params;

    if (!query || !results || !Array.isArray(results)) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Cache the results for 24 hours
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + 86400);

    await context.redis.set(`gifSearch:${query.toLowerCase()}`, JSON.stringify(results), {
      expiration: expirationDate,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get games created by a specific user
export async function getUserGames(
  params: { username: string; limit?: number },
  context: Context
): Promise<GetRecentGamesResponse> {
  try {
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
            gameData.gifs = [];
          }
        }

        games.push(gameData);
      }
    }

    return {
      success: true,
      games,
      message: `Found ${games.length} games created by ${username}`,
    };
  } catch (error) {
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
    const { query } = params;

    if (!query) {
      return { success: false, error: 'Invalid query' };
    }

    const cachedResults = await context.redis.get(`gifSearch:${query.toLowerCase()}`);

    if (!cachedResults) {
      return { success: false, cached: false };
    }

    return { success: true, cached: true, results: JSON.parse(cachedResults) };
  } catch (error) {
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
    const { username, gameId, playerState } = params;

    if (!username || !gameId || !playerState) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Create a key for this user's state for this specific game
    const gameStateKey = `gameState:${gameId}:${username}`;

    // Store the player state as a JSON string
    // Remove undefined fields before saving
    const cleanedState = Object.fromEntries(
      Object.entries(playerState).filter(([_, v]) => v !== undefined)
    );
    await context.redis.hSet(gameStateKey, {
      playerState: JSON.stringify(cleanedState),
      lastUpdated: Date.now().toString(),
    });

    // Set an expiration on the game state (30 days)
    await context.redis.expire(gameStateKey, 30 * 24 * 60 * 60);

    // If the game is completed, add it to the user's completed games set
    if (playerState.isCompleted) {
      await context.redis.zAdd(`user:${username}:completedGames`, {
        member: gameId,
        score: Date.now(), // Using timestamp as score for sorting
      });
    }

    return { success: true };
  } catch (error) {
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
        const parsedState = JSON.parse(gameState.playerState);
        gameState.playerState = parsedState;
      }
    } catch (e) {
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
    return { success: false, error: String(error) };
  }
}

// Track guess attempts for a game
export async function trackGuess(
  params: {
    gameId: string;
    username: string;
    guess: string;
  },
  context: Context
) {
  try {
    const { gameId, username, guess } = params;

    if (!gameId || !username || !guess) {
      return { success: false, error: 'Missing required parameters' };
    }

    const normalizedGuess = guess
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/[^\w]/g, '') // Remove all non-word characters (punctuation)
      .trim()
      .toUpperCase();

    // Increment the guess count for this specific guess
    await context.redis.zIncrBy(`gameGuesses:${gameId}`, normalizedGuess, 1);

    // Track total guesses for this game
    await context.redis.incrBy(`gameTotalGuesses:${gameId}`, 1);

    // Track unique players who have made guesses (using zAdd with timestamp as score)
    await context.redis.zAdd(`gamePlayers:${gameId}`, {
      member: username,
      score: Date.now(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get game statistics including all guesses
export async function getGameStatistics(
  params: { gameId: string },
  context: Context
): Promise<GetGameStatisticsResponse> {
  try {
    const { gameId } = params;

    if (!gameId) {
      return { success: false, error: 'Game ID is required' };
    }

    // Get the game data to get the answer
    const gameData = await context.redis.hGetAll(`game:${gameId}`);
    
    if (!gameData || !gameData.word) {
      return { success: false, error: 'Game not found' };
    }

    // Get all guesses with their counts using rank-based zRange
    const guessesWithScores = await context.redis.zRange(`gameGuesses:${gameId}`, 0, -1, {
      by: 'rank',
      reverse: true, // Highest scores first
    });

    // Get total number of guesses made
    const totalGuessesStr = await context.redis.get(`gameTotalGuesses:${gameId}`);
    const totalGuesses = totalGuessesStr ? parseInt(totalGuessesStr) : 0;
    const playersCount = await context.redis.zCard(`gamePlayers:${gameId}`);

    // Format the guesses data
    const guesses: GuessData[] = [];
    
    for (const item of guessesWithScores) {
      // Redis zRange with reverse returns items with {member, score} structure
      if (item && typeof item === 'object' && 'member' in item && 'score' in item) {
        const count = item.score;
        const percentage = totalGuesses > 0 ? (count / totalGuesses) * 100 : 0;
        
        guesses.push({
          guess: item.member,
          count: count,
          percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        });
      }
    }

    return {
      success: true,
      statistics: {
        gameId,
        answer: gameData.word.toUpperCase(),
        totalPlayers: playersCount,
        totalGuesses,
        guesses,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
