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
import { getSemanticSynonyms, validateGifWordMatch } from './geminiService.js';

export async function saveGame(params: CreatorData, context: Context): Promise<SaveGameResponse> {
  try {
    const {
      word,
      maskedWord,
      category,
      questionText,
      gifs,
      gifDescriptions,
      searchTerms,
      postToSubreddit = true,
      isChatPost = false,
      inputType = 'word',
    } = params;
    
    let username = 'anonymous';
    try {
      const user = await context.reddit.getCurrentUser();
      username = user?.username || 'anonymous';
    } catch (error) {
      username = 'system';
    }

    const systemUsernames = [
      'gif-enigma',
      'anonymous',
      'GIFEnigmaBot',
      'system',
      'AutoModerator',
      'reddit',
    ];
    
    const isSystemUser = systemUsernames.some(sysUser => 
      username.toLowerCase() === sysUser.toLowerCase()
    );

    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (gifDescriptions && gifDescriptions.length === 4) {
      await validateGifWordMatch(
        {
          word,
          gifDescriptions,
          searchTerms: searchTerms || [],
        },
        context
      );
    }
    let acceptedSynonyms: string[] = [];
    const semanticResult = await getSemanticSynonyms({ word }, context);
    if (semanticResult.success && semanticResult.synonyms) {
      acceptedSynonyms = semanticResult.synonyms;
    }

    const tx = await context.redis.watch('games');
    await tx.multi();

    await tx.hSet(`game:${gameId}`, {
      word,
      category: category || 'Viral Vibes',
      maskedWord: maskedWord || '',
      questionText: questionText || '',
      gifs: JSON.stringify(gifs),
      createdAt: Date.now().toString(),
      username,
      inputType: inputType || 'word',
      acceptedSynonyms: JSON.stringify(acceptedSynonyms), // Store for validation
    });    await tx.zAdd('activeGames', { score: Date.now(), member: gameId });
    await tx.exec();

    let postId = null;
    if (postToSubreddit) {
      const subreddit = await context.reddit.getCurrentSubreddit();
      const subredditName = subreddit?.name || 'PlayGIFEnigma';
      const allowChatPostCreation = await context.settings.get('allowChatPostCreation');
      const postTitle = questionText || `Can you decode the ${inputType} from this GIF?`;
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

    let bonusResult: { success: boolean; bonusAwarded: boolean; error?: string } = { 
      success: true, 
      bonusAwarded: false 
    };
    
    if (!isSystemUser) {
      const result = await awardCreationBonus(username, context);
      bonusResult = {
        success: result.success,
        bonusAwarded: result.bonusAwarded || false,
        error: result.error
      };
    }

    if (username && username !== 'anonymous' && !isSystemUser) {
      await context.redis.zAdd(`user:${username}:completedGames`, {
        member: gameId,
        score: Date.now(),
      });

      await context.redis.hSet(`gameState:${username}:${gameId}`, {
        playerState: JSON.stringify({
          gifHintCount: 0,
          revealedLetters: [],
          guess: '',
          lastPlayed: Date.now(),
          isCompleted: true,
          isCreator: true,
        }),
        lastUpdated: Date.now().toString(),
      });
    }

    return {
      success: true,
      gameId,
      postedToReddit: !!postId,
      redditPostId: postId || undefined,
      bonusAwarded: bonusResult.bonusAwarded,
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

    const systemUsernames = [
      'gif-enigma',
      'anonymous',
      'GIFEnigmaBot',
      'system',
      'AutoModerator',
      'reddit',
    ];

    if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
      return { success: false, error: 'System users cannot post comments' };
    }

    if (gifHints >= 999 || numGuesses >= 999) {
      return { success: false, error: 'Cannot post comment for games where user gave up' };
    }

    const commentKey = `comment:${gameId}:${username}`;
    const existingComment = await context.redis.get(commentKey);

    if (existingComment) {
      return { success: true, alreadyPosted: true };
    }

    let postId = redditPostId;
    if (!postId) {
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      postId = gameData.redditPostId;
    }

    if (!postId) {
      return { success: false, error: 'No Reddit post ID found for this game' };
    }

    // Determine performance tier and emoji
    const usedNoHints = gifHints === 0;
    let emoji = '';
    let commentVariant = Math.floor(Math.random() * 3);

    // Calculate performance tier based on attempts and hints
    if (numGuesses === 1 && usedNoHints) {
      emoji = '🎉🏆✨';
    } else if (numGuesses === 1) {
      emoji = '🎉🔥';
    } else if (numGuesses === 2 && gifHints <= 1) {
      emoji = '💪⚡';
    } else if (numGuesses <= 3) {
      emoji = '💪';
    } else if (numGuesses <= 5) {
      emoji = '🤔';
    } else {
      emoji = '😅💪';
    }

    // Create hints description
    let hintsDescription = '';
    if (usedNoHints) {
      hintsDescription = 'with just the first GIF';
    } else if (gifHints === 1) {
      hintsDescription = 'using 1 extra GIF hint';
    } else {
      hintsDescription = `using ${gifHints} extra GIF hints`;
    }

    let completionText = '';

    if (numGuesses === 1 && usedNoHints) {
      // Legendary performance - first try, no hints
      const legendaryTexts = [
        `I cracked it on my **first attempt** with **just the first GIF**! ${emoji}`,
        `**First try**, **no extra hints** needed! Nailed it! ${emoji}`,
        `Got it instantly with **only one GIF**! **First attempt**! ${emoji}`
      ];
      completionText = legendaryTexts[commentVariant];
    } else if (numGuesses === 1) {
      // Master performance - first try with hints
      const masterTexts = [
        `I solved it on my **first attempt** ${hintsDescription}! ${emoji}`,
        `**First try!** Cracked it ${hintsDescription}! ${emoji}`,
        `Got it right away on **attempt #1** ${hintsDescription}! ${emoji}`
      ];
      completionText = masterTexts[commentVariant];
    } else if (numGuesses === 2) {
      // Quick solver
      const quickTexts = [
        `Solved it in **${numGuesses} attempts** ${hintsDescription}! ${emoji}`,
        `Cracked the code in **${numGuesses} tries** ${hintsDescription}! ${emoji}`,
        `Got it in **${numGuesses} attempts** ${hintsDescription}! ${emoji}`
      ];
      completionText = quickTexts[commentVariant];
    } else if (numGuesses <= 4) {
      // Good performance
      const goodTexts = [
        `Figured it out in **${numGuesses} attempts** ${hintsDescription}! ${emoji}`,
        `Solved in **${numGuesses} tries** ${hintsDescription}! ${emoji}`,
        `Cracked it after **${numGuesses} attempts** ${hintsDescription}! ${emoji}`
      ];
      completionText = goodTexts[commentVariant];
    } else if (numGuesses <= 7) {
      // Persistent solver
      const persistentTexts = [
        `Finally got it in **${numGuesses} attempts** ${hintsDescription}! ${emoji}`,
        `Persistence paid off! Solved in **${numGuesses} tries** ${hintsDescription}! ${emoji}`,
        `Conquered it after **${numGuesses} attempts** ${hintsDescription}! ${emoji}`
      ];
      completionText = persistentTexts[commentVariant];
    } else {
      // Very persistent solver (7+ attempts) - keep same wording
      const veryPersistentTexts = [
        `Finally got it in **${numGuesses} attempts** ${hintsDescription}! ${emoji}`,
        `Persistence paid off! Solved in **${numGuesses} tries** ${hintsDescription}! ${emoji}`,
        `Conquered it after **${numGuesses} attempts** ${hintsDescription}! ${emoji}`
      ];
      completionText = veryPersistentTexts[commentVariant];
    }

    // Add special badge for no-hint achievements
    if (usedNoHints && numGuesses <= 3) {
      completionText += ' 🧠';
    }

    try {
      // Post the comment to Reddit
      await context.reddit.submitComment({
        id: postId,
        text: completionText,
      });

      // Mark as posted in Redis to prevent duplicates
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
          category: rawGameData.category || 'Viral Vibes',
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
      category: rawGameData.category || 'Pop Culture',
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

    const systemUsernames = [
      'gif-enigma',
      'anonymous',
      'GIFEnigmaBot',
      'system',
      'AutoModerator',
      'reddit',
    ];

    if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
      return { success: false, error: 'System users cannot save game state' };
    }

    const gameStateKey = `gameState:${username}:${gameId}`;

    const cleanedState = Object.fromEntries(
      Object.entries(playerState).filter(([_, v]) => v !== undefined)
    );
    await context.redis.hSet(gameStateKey, {
      playerState: JSON.stringify(cleanedState),
      lastUpdated: Date.now().toString(),
    });

    await context.redis.expire(gameStateKey, 30 * 24 * 60 * 60);

    if (playerState.isCompleted) {
      await context.redis.zAdd(`user:${username}:completedGames`, {
        member: gameId,
        score: Date.now(),
      });
      
      // Also track this completion in the game's completion set (for statistics)
      await context.redis.zAdd(`gameCompletions:${gameId}`, {
        member: username,
        score: Date.now(),
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

    const gameStateKey = `gameState:${username}:${gameId}`;
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
          if (gameData.gifs) {
            gameData.gifs = JSON.parse(gameData.gifs);
          }

          unplayedGames.push({ id: gameId, ...gameData });
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
      .replace(/\s+/g, '') 
      .replace(/[^\w]/g, '')
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
  params: { gameId: string; username?: string },
  context: Context
): Promise<GetGameStatisticsResponse> {
  try {
    const { gameId, username } = params;

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

    // Fetch player's score if username is provided
    let playerScore: number | undefined;
    if (username && username !== 'anonymous') {
      const scoreKey = `score:${gameId}:${username}`;
      const scoreData = await context.redis.hGetAll(scoreKey);
      if (scoreData && scoreData.score) {
        playerScore = parseInt(scoreData.score);
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
        creatorUsername: gameData.username,
        acceptedSynonyms: gameData.acceptedSynonyms ? JSON.parse(gameData.acceptedSynonyms) : [],
        playerScore,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function validateGuess(
  params: {
    gameId: string;
    guess: string;
  },
  context: Context
): Promise<{
  success: boolean;
  isCorrect: boolean;
  matchType?: 'exact' | 'synonym';
  error?: string;
}> {
  try {
    const { gameId, guess } = params;

    if (!gameId || !guess) {
      return { success: false, isCorrect: false, error: 'Missing required parameters' };
    }

    // Get the game data to access the answer
    const gameData = await context.redis.hGetAll(`game:${gameId}`);
    
    if (!gameData || !gameData.word) {
      return { success: false, isCorrect: false, error: 'Game not found' };
    }

    const answer = gameData.word;
    
    const normalizeString = (str: string) => 
      str.replace(/\s+/g, '').replace(/[^\w]/g, '').trim().toUpperCase();
    
    const normalizedGuess = normalizeString(guess);
    const normalizedAnswer = normalizeString(answer);

    // Check for exact match first
    if (normalizedGuess === normalizedAnswer) {
      return {
        success: true,
        isCorrect: true,
        matchType: 'exact',
      };
    }

    // Check if lengths are the same (no spaces/punctuation)
    if (normalizedGuess.length !== normalizedAnswer.length) {
      return {
        success: true,
        isCorrect: false,
      };
    }

    if (gameData.acceptedSynonyms) {
      const acceptedSynonyms: string[] = JSON.parse(gameData.acceptedSynonyms);
      const normalizedSynonyms = acceptedSynonyms.map((syn: string) => normalizeString(syn));
      
      const isValidSynonym = normalizedSynonyms.includes(normalizedGuess);
      
      if (isValidSynonym) {
        return {
          success: true,
          isCorrect: true,
          matchType: 'synonym',
        };
      }
    }

    // Not an exact match or valid synonym
    return {
      success: true,
      isCorrect: false,
    };

  } catch (error) {
    return {
      success: false,
      isCorrect: false,
      error: String(error),
    };
  }
}
