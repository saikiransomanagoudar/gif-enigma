import express from 'express';
import { createServer, getServerPort, redis, reddit } from '@devvit/web/server';
import type { UiResponse } from '@devvit/shared';
import { searchGiphyGifs, searchMultipleGiphyGifs } from '../../game/server/giphyApi.server.js';
import {
  saveGame,
  getGame,
  getUnplayedGames,
  getGameState,
  saveGameState,
  getRandomGame,
  postCompletionComment,
  hasUserCompletedGame,
  removeSystemUsersFromLeaderboard,
  trackGuess,
  getGameStatistics,
  validateGuess,
  getCreatorBonusStats,
  getGameLeaderboard,
  checkUserComment,
} from '../../game/server/gameHandler.server.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../../game/server/geminiApi.server.js';
import {
  saveScore,
  getGlobalLeaderboard,
  calculateScore,
  getCumulativeLeaderboard,
} from '../../game/server/scoringService.js';
import { fetchMultiplePreGenerated } from '../../game/server/dailyPreGenerator.js';
import { validateGifWordMatch } from '../../game/server/geminiService.js';

type CategoryType = 'Viral Vibes' | 'Cinematic Feels' | 'Gaming Moments' | 'Story Experiences';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const createContext = () => ({ reddit, redis }) as any;

app.get('/api/user/current', async (_req: any, res: any) => {
  try {
    const username = await reddit.getCurrentUsername();
    res.json({
      success: true,
      username: username ?? null,
      user: username ? { username } : null,
    });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/user/stats', async (req: any, res: any) => {
  try {
    const username = req.query.username as string | undefined;

    if (!username) {
      res.json({ success: false, error: 'username required' });
      return;
    }

    const statsData = await redis.hGetAll(`userStats:${username}`);

    const stats = (!statsData || Object.keys(statsData).length === 0) ? {
      username,
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      bestScore: 0,
      score: 0,
      averageScore: 0,
      gamesCreated: 0,
      creatorBonusEarned: 0,
      lastPlayed: 0,
    } : {
      username,
      gamesPlayed: Number(statsData.gamesPlayed ?? 0),
      gamesWon: Number(statsData.gamesWon ?? 0),
      totalScore: Number(statsData.totalScore ?? 0),
      bestScore: Number(statsData.bestScore ?? 0),
      score: Number(statsData.totalScore ?? 0),
      averageScore: Number(statsData.averageScore ?? 0),
      gamesCreated: Number(statsData.gamesCreated ?? 0),
      creatorBonusEarned: Number(statsData.creatorBonusEarned ?? 0),
      lastPlayed: Number(statsData.lastPlayed ?? 0),
    };

    // Use Redis ZRANK + ZCARD for O(log n) rank lookup - always check regardless of score
    let rank = 0;
    try {
      const [forwardRank, totalMembers] = await Promise.all([
        redis.zRank('cumulativeLeaderboard', username),
        redis.zCard('cumulativeLeaderboard'),
      ]);
      
      if (forwardRank !== null && forwardRank !== undefined && totalMembers) {
        rank = totalMembers - forwardRank;
      }
    } catch {
      // Fallback if rank lookup fails
      rank = 0;
    }

    res.json({ success: true, stats, rank });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/check-limit', async (_req: any, res: any) => {
  try {
    const username = await reddit.getCurrentUsername();

    if (!username) {
      return res.json({
        success: false,
        canCreate: false,
        error: 'User not authenticated',
      });
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const recentCreationsKey = `user:${username}:recentCreations`;

    await redis.zRemRangeByScore(recentCreationsKey, 0, twentyFourHoursAgo);

    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const allPendingToClean = await redis.zRange(recentCreationsKey, 0, -1, {
      by: 'rank',
    });
    for (const entry of allPendingToClean) {
      const member = entry.member.toString();
      if (member.startsWith('pending_') && entry.score < fiveMinutesAgo) {
        await redis.zRem(recentCreationsKey, [member]);
      }
    }

    const allEntries = await redis.zRange(recentCreationsKey, 0, -1, {
      by: 'rank',
    });

    // Count both completed games and pending reservations
    const recentCreations = allEntries.filter((entry) => {
      const member = entry.member.toString();
      return member.startsWith('game_') || member.startsWith('pending_');
    });

    const creationCount = recentCreations.length;
    const canCreate = creationCount < 4;

    let resetTime = null;
    let timeRemainingMs = 0;
    if (creationCount > 0) {
      const oldestCreation = recentCreations[0];
      if (oldestCreation && oldestCreation.score !== undefined) {
        resetTime = oldestCreation.score + 24 * 60 * 60 * 1000;
        timeRemainingMs = Math.max(0, resetTime - now);
      }
    }

    res.json({
      success: true,
      canCreate,
      creationCount,
      maxCreations: 4,
      resetTime: resetTime ? new Date(resetTime).toISOString() : null,
      timeRemainingMs,
    });
  } catch (error) {
    res.json({
      success: false,
      canCreate: false,
      error: String(error),
    });
  }
});

app.get('/api/post/current/game', async (req: any, res: any) => {
  try {
    const rawPostId =
      req.headers['x-reddit-post-id'] || req.query.postId || req.query.post_id || req.query.post;

    if (!rawPostId) {
      res.json({ success: false, error: 'No post context available' });
      return;
    }

    const postId = typeof rawPostId === 'string' ? rawPostId : String(rawPostId);
    const normalizedPostId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    let gameData = await redis.hGetAll(`post:${normalizedPostId}`);

    if (!gameData || !gameData.gameId) {
      gameData = await redis.hGetAll(`post:${postId}`);
    }

    if (!gameData || !gameData.gameId) {
      res.json({ success: false, error: 'Game not found for this post' });
      return;
    }

    res.json({ success: true, gameId: gameData.gameId });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Get gameId by post ID
app.get('/api/post/:postId/game', async (req: any, res: any) => {
  try {
    const postId = req.params.postId as string;
    const normalizedPostId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    let gameData = await redis.hGetAll(`post:${normalizedPostId}`);
    if (!gameData || !gameData.gameId) {
      gameData = await redis.hGetAll(`post:${postId}`);
    }

    if (!gameData || !gameData.gameId) {
      res.json({ success: false, error: 'Game not found for this post' });
      return;
    }

    res.json({ success: true, gameId: gameData.gameId });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/completed', async (req: any, res: any) => {
  try {
    const { username, gameId } = req.query;
    const result = await hasUserCompletedGame(
      { username: username as string, gameId: gameId as string },
      createContext()
    );
    res.json({ success: true, hasCompleted: result.completed });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/completed', async (req: any, res: any) => {
  try {
    const { username, gameId } = req.query;
    const result = await hasUserCompletedGame(
      { username: username as string, gameId: gameId as string },
      createContext()
    );
    res.json({ success: true, hasCompleted: result.completed });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/statistics', async (req: any, res: any) => {
  try {
    const { gameId } = req.query;
    let resolvedGameId = gameId as string;

    if (resolvedGameId && !resolvedGameId.startsWith('game_')) {
      const normalizedPostId = resolvedGameId.startsWith('t3_')
        ? resolvedGameId
        : `t3_${resolvedGameId}`;
      let postData = await redis.hGetAll(`post:${normalizedPostId}`);
      if (!postData || !postData.gameId) {
        postData = await redis.hGetAll(`post:${resolvedGameId}`);
      }
      if (postData && postData.gameId) {
        resolvedGameId = postData.gameId as string;
      }
    }

    const result = await getGameStatistics({ gameId: resolvedGameId }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Get game state (MUST be before catch-all route)
app.get('/api/game/state', async (req: any, res: any) => {
  try {
    const { username, userId, gameId } = req.query;
    const resolvedUsername = (username as string) || (userId as string);
    const result = await getGameState(
      { username: resolvedUsername, gameId: gameId as string },
      createContext()
    );
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/check-comment', async (req: any, res: any) => {
  try {
    const { gameId, username } = req.query;

    if (!gameId || !username) {
      res.json({ success: false, error: 'Missing gameId or username' });
      return;
    }

    const result = await checkUserComment(gameId, username, createContext());

    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/game/:gameId', async (req: any, res: any) => {
  try {
    const gameId = req.params.gameId as string;
    const result = await getGame({ gameId }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Get random game
app.post('/api/game/random', async (req: any, res: any) => {
  try {
    const { username, excludeIds, preferUserCreated, useStickyNavigation } = req.body;
    const result = await getRandomGame(
      { username, excludeIds, preferUserCreated, useStickyNavigation },
      createContext()
    );
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Manual Create
app.post('/api/game/manual-create', async (req: any, res: any) => {
  try {
    const { word, category, inputType, maskedWord, questionText, gifs, gifDescriptions, searchTerms } = req.body;

    if (!word || !category || !inputType || !maskedWord || !questionText) {
      res.json({ success: false, error: 'Missing required fields' });
      return;
    }

    if (!gifs || !Array.isArray(gifs) || gifs.length !== 4) {
      res.json({ success: false, error: 'Need exactly 4 GIF URLs' });
      return;
    }

    res.json({ success: true, message: 'Manual Create started in background' });

    (async () => {
      try {
        const gameData = {
          word,
          category,
          maskedWord,
          questionText,
          gifs,
          gifDescriptions: gifDescriptions || [],
          searchTerms: searchTerms || [],
          inputType,
          postToSubreddit: true,
          runAsUser: true,
        };

        await saveGame(gameData, createContext());
      } catch (error) {
        // Background process, errors are silent
      }
    })();

  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Quick Create
app.post('/api/game/quick-create', async (req: any, res: any) => {
  try {
    const { word, category, inputType, synonyms: clientSynonyms } = req.body;

    if (!word || !category || !inputType) {
      res.json({ success: false, error: 'Missing required fields' });
      return;
    }

    if (!clientSynonyms || clientSynonyms.length < 4) {
      res.json({ success: false, error: 'Need at least 4 synonyms' });
      return;
    }

    res.json({ success: true, message: 'Quick Create started in background' });

    (async () => {
      try {
        const synonymsToFetch = clientSynonyms.slice(0, 4);

        const gifResults = await searchMultipleGiphyGifs(createContext(), synonymsToFetch, 10);

        const autoGifUrls: string[] = [];
        const autoGifDescriptions: string[] = [];
        const autoSearchTerms: string[] = [];

        for (const synonym of synonymsToFetch) {
          const gifs = gifResults[synonym];
          if (gifs && gifs.length > 0) {
            const gif = gifs[0];
            const gifUrl = gif.media_formats?.tinygif?.url || gif.url;
            if (gifUrl) {
              autoGifUrls.push(gifUrl);
              autoGifDescriptions.push(gif.content_description || gif.title || synonym);
              autoSearchTerms.push(synonym);
            }
          }
        }

        if (autoGifUrls.length < 4) {
          return;
        }

        const wordArray = word.split('');
        const maskCount = Math.floor((wordArray.length * 2) / 3);
        const indicesToMask = new Set<number>();
        while (indicesToMask.size < maskCount) {
          indicesToMask.add(Math.floor(Math.random() * wordArray.length));
        }
        const maskedWord = wordArray
          .map((char: string, i: number) => (indicesToMask.has(i) && char !== ' ' ? '_' : char))
          .join('');

        const questionText =
          inputType === 'word'
            ? 'Can you decode the word from this GIF?'
            : 'Can you decode the phrase from this GIF?';

        const gameData = {
          word,
          category,
          maskedWord,
          questionText,
          gifs: autoGifUrls,
          gifDescriptions: autoGifDescriptions,
          searchTerms: autoSearchTerms,
          inputType,
          postToSubreddit: true,
          runAsUser: true,
        };

        await saveGame(gameData, createContext());
      } catch (error) {
        // Background process - errors are silent
      }
    })();

  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Save game
app.post('/api/game/save', async (req: any, res: any) => {
  try {
    const result = await saveGame(req.body, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Save game state
app.post('/api/game/state', async (req: any, res: any) => {
  try {
    const { username, userId, gameId, playerState } = req.body;
    const resolvedUsername = username || userId;
    await saveGameState({ username: resolvedUsername, gameId, playerState }, createContext());
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Submit guess
app.post('/api/game/guess', async (req: any, res: any) => {
  try {
    const { username, gameId, guess } = req.body;
    const result = await validateGuess({ username, gameId, guess }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Track guess
app.post('/api/game/track-guess', async (req: any, res: any) => {
  try {
    const { username, gameId, guess } = req.body;
    await trackGuess({ username, gameId, guess }, createContext());
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Post completion comment
app.post('/api/game/completion-comment', async (req: any, res: any) => {
  try {
    const { gameId, username, numGuesses, gifHints, redditPostId } = req.body;

    if (!gameId || !username) {
      res.json({ success: false, error: 'Missing gameId or username' });
      return;
    }

    const result = await postCompletionComment(
      { gameId, username, numGuesses, gifHints, redditPostId },
      createContext()
    );

    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.post('/api/giphy/search', async (req: any, res: any) => {
  try {
    const { query, limit } = req.body;
    const results = await searchGiphyGifs(createContext(), query, limit);
    res.json({ success: true, results });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.post('/api/giphy/search-multiple', async (req: any, res: any) => {
  try {
    const { queries, limit } = req.body;

    if (!queries || !Array.isArray(queries)) {
      return res.json({ success: false, error: 'Invalid queries parameter' });
    }

    const results = await searchMultipleGiphyGifs(createContext(), queries, limit);
    res.json({ success: true, results });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Gemini recommendations
app.post('/api/gemini/recommendations', async (req: any, res: any) => {
  try {
    const { category, inputType, count } = req.body;
    const result = await fetchGeminiRecommendations(createContext(), category, inputType, count);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Gemini synonyms
app.post('/api/gemini/synonyms', async (req: any, res: any) => {
  try {
    const { word } = req.body;
    const result = await fetchGeminiSynonyms(createContext(), word);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Save score
app.post('/api/score/save', async (req: any, res: any) => {
  try {
    const result = await saveScore(req.body, createContext());
    
    // Send one-time welcome PM for first successful completion
    if (result.success && req.body.score > 0 && req.body.username) {
      const username = req.body.username;
      const pmFlagKey = `user:${username}`;
      const pmFlagField = 'welcomePMSent';
      
      try {
        const alreadySent = await redis.get(`${pmFlagKey}:${pmFlagField}`);
        
        if (!alreadySent) {
          const subject = 'Thanks for playing GIF Enigma!';
          const text =
            '**Nice work decoding a GIF Enigma!** 🎉\n\n' +
            'If you want more interesting GIF puzzles in your feed **please join us at [r/PlayGIFEnigma](https://www.reddit.com/r/PlayGIFEnigma)**. ' +
            'And, if you have any feedback or ideas, feel free to reply here or contact us via mod mail.';
          
          const toUsername = String(username).trim().replace(/^u\//i, '');
          
          try {
            await reddit.sendPrivateMessage({
              subject,
              text,
              to: toUsername,
            });
            await redis.set(`${pmFlagKey}:${pmFlagField}`, '1');
          } catch (pmErr: any) {
            const errorMessage = pmErr?.details || pmErr?.message || String(pmErr);
            
            // Mark as sent even if user has blocked PMs
            if (errorMessage.includes('NOT_WHITELISTED_BY_USER_MESSAGE')) {
              await redis.set(`${pmFlagKey}:${pmFlagField}`, '1');
            }
          }
        }
      } catch (pmError) {
        // Don't fail the score save if PM fails
      }
    }
    
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Calculate score
app.post('/api/score/calculate', async (req: any, res: any) => {
  try {
    const score = calculateScore(req.body);
    res.json({ success: true, score });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Global leaderboard
app.get('/api/leaderboard/global', async (req: any, res: any) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await getGlobalLeaderboard({ limit }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Cumulative leaderboard
app.get('/api/leaderboard/cumulative', async (req: any, res: any) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await getCumulativeLeaderboard({ limit }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.get('/api/debug/leaderboard-data', async (_req: any, res: any) => {
  try {
    const cumulativeUsers = await redis.zRange('cumulativeLeaderboard', 0, -1, {
      by: 'rank',
      reverse: true,
    });
    const globalEntries = await redis.zRange('globalLeaderboard', 0, -1, {
      by: 'rank',
      reverse: true,
    });

    // Get sample user stats for debugging
    const sampleUserStats: any = {};
    for (let i = 0; i < Math.min(5, cumulativeUsers.length); i++) {
      const username =
        typeof cumulativeUsers[i].member === 'string'
          ? cumulativeUsers[i].member
          : String(cumulativeUsers[i].member);
      sampleUserStats[username] = await redis.hGetAll(`userStats:${username}`);
    }

    res.json({
      success: true,
      cumulativeLeaderboard: {
        total: cumulativeUsers.length,
        entries: cumulativeUsers.slice(0, 10),
      },
      globalLeaderboard: {
        total: globalEntries.length,
      },
      sampleUserStats,
      redisInfo: 'Data persists in installed apps but is ephemeral in playtest mode',
    });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Creator bonus stats
app.get('/api/creator/bonus-stats', async (req: any, res: any) => {
  try {
    const { gameId } = req.query;
    const result = await getCreatorBonusStats(gameId as string, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.post('/api/game/pre-generated', async (req: any, res: any) => {
  try {
    const { category, inputType, count } = req.body;
    const result = await fetchMultiplePreGenerated(createContext(), category, inputType, count);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.post('/api/admin/trigger-pregeneration', async (req: any, res: any) => {
  try {
    const force = req.body?.force || false;
    const { preGenerateItems } = await import('../../game/server/dailyPreGenerator.js');
    await preGenerateItems(createContext(), force);
    res.json({
      success: true,
      message: 'Pre-generation completed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

app.get('/api/admin/pregeneration-status', async (_req: any, res: any) => {
  try {
    const stats = await redis.get('pregenerated:stats');
    const lastRun = await redis.get('pregenerated:last_run');

    const categoryCounts: Record<string, any> = {};
    const categories: CategoryType[] = [
      'Viral Vibes',
      'Cinematic Feels',
      'Gaming Moments',
      'Story Experiences',
    ];
    const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];

    for (const category of categories) {
      categoryCounts[category] = {};
      for (const inputType of inputTypes) {
        const metaKey = `pregenerated:meta:${category}:${inputType}`;
        const countStr = await redis.get(metaKey);
        categoryCounts[category][inputType] = countStr ? parseInt(countStr) : 0;
      }
    }

    res.json({
      hasRun: !!lastRun,
      lastRun: lastRun || null,
      stats: stats ? JSON.parse(stats) : null,
      categoryCounts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

app.post('/api/game/mark-completed', async (req: any, res: any) => {
  try {
    const { username, gameId, gifHintCount, revealedLetters, finalGuess, hasGivenUp, timeTaken } =
      req.body;
    const ctx = createContext();

    let resolvedUsername = username;
    if (!username || username.toLowerCase() === 'anonymous') {
      const fetched = await reddit.getCurrentUsername();
      if (fetched) resolvedUsername = fetched;
    }

    if (!resolvedUsername) {
      res.json({ success: false, error: 'Username is required to mark completion' });
      return;
    }

    const playerState = {
      gifHintCount: gifHintCount || 0,
      revealedLetters: revealedLetters || [],
      guess: finalGuess || '',
      lastPlayed: Date.now(),
      isCompleted: !hasGivenUp,
      hasGivenUp: hasGivenUp || false,
    };

    const saveResult = await saveGameState(
      { gameId, username: resolvedUsername, playerState },
      ctx
    );
    if (!saveResult?.success) {
      res.json({ success: false, error: saveResult?.error || 'Failed to save game state' });
      return;
    }

    // Add game to user's completed games set
    const completedGamesKey = `user:${resolvedUsername}:completedGames`;
    await redis.zAdd(completedGamesKey, { score: Date.now(), member: gameId });

    const gameResult = await getGame({ gameId }, ctx);
    if (gameResult.success && gameResult.game && gameResult.game.word) {
      let scoreData;
      if (hasGivenUp) {
        // User gave up - save with 0 score
        scoreData = {
          score: 0,
          gifPenalty: 0,
          wordPenalty: 0,
          timeTaken: timeTaken || 0,
        };
      } else {
        // User completed normally - calculate actual score
        scoreData = calculateScore({
          word: gameResult.game.word,
          gifHintCount: playerState.gifHintCount,
          revealedLetterCount: playerState.revealedLetters.length,
          timeTaken: timeTaken || 0,
        });
      }

      await saveScore(
        {
          username: resolvedUsername,
          gameId,
          score: scoreData.score,
          gifPenalty: scoreData.gifPenalty,
          wordPenalty: scoreData.wordPenalty,
          timeTaken: scoreData.timeTaken,
          timestamp: Date.now(),
        },
        ctx
      );

      await redis.del(`user:${resolvedUsername}:assignedGame`);
    }

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Get game leaderboard
app.get('/api/leaderboard/game', async (req: any, res: any) => {
  try {
    const gameId = req.query.gameId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const result = await getGameLeaderboard({ gameId, limit }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Get unplayed games for a user
app.get('/api/game/unplayed', async (req: any, res: any) => {
  try {
    const username = req.query.username as string;
    const category = req.query.category as string | undefined;
    if (!username) {
      res.json({ success: false, error: 'username required' });
      return;
    }
    const result = await getUnplayedGames({ username, category }, createContext());
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

// Remove system users from leaderboard
app.post('/api/leaderboard/clean', async (req: any, res: any) => {
  try {
    const result = await removeSystemUsersFromLeaderboard(createContext(), true);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: String(error) });
  }
});

app.post('/internal/scheduler/auto-create-post', async (req: any, res: any) => {
  try {
    const force = Boolean(req.body?.data?.force);

    if (!force) {
      try {
        const subreddit = await reddit.getCurrentSubreddit();
        const subredditName = subreddit?.name?.toLowerCase();
        if (subredditName !== 'playgifenigma') {
          res.json({ status: 'skipped: wrong subreddit' });
          return;
        }
      } catch {
        res.json({ status: 'skipped: subreddit check failed' });
        return;
      }
    }

    if (!force) {
      try {
        const now = new Date();
        const dateParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false,
        })
          .formatToParts(now)
          .reduce((acc: any, p) => {
            if (p.type !== 'literal') acc[p.type] = p.value;
            return acc;
          }, {} as any);

        const yyyy = dateParts.year;
        const mm = dateParts.month;
        const dd = dateParts.day;
        const hh = dateParts.hour;
        const lockKey = `autoPostLock:${yyyy}-${mm}-${dd}:${hh}`;

        const setResult = await redis.set(lockKey, '1', {
          nx: true,
          ex: 7200,
        } as any);

        if (!setResult) {
          res.json({ status: 'skipped: lock exists' });
          return;
        }
      } catch {
        res.json({ status: 'skipped: lock/time failed' });
        return;
      }
    }

    const categories: CategoryType[] = [
      'Cinematic Feels',
      'Gaming Moments',
      'Story Experiences',
      'Viral Vibes',
    ];
    const fallbackData: Record<CategoryType, { word: string[]; phrase: string[] }> = {
      'Cinematic Feels': {
        word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN'],
        phrase: ['MAY THE FORCE BE WITH YOU', 'TO INFINITY AND BEYOND'],
      },
      'Gaming Moments': {
        word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE'],
        phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE'],
      },
      'Story Experiences': {
        word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA'],
        phrase: ['ONCE UPON A TIME', 'THE END', 'TO BE CONTINUED'],
      },
      'Viral Vibes': {
        word: ['RICKROLL', 'CRINGE', 'AWKWARD', 'HYPE', 'SHOCKED'],
        phrase: ['MIC DROP', 'SIDE EYE', 'PLOT TWIST', 'GLOW UP'],
      },
    };
    const fallbackSynonyms: Record<string, string[][]> = {
      'STARWARS': [
        ['space', 'lightsaber', 'force', 'jedi'],
        ['galaxy', 'darth', 'vader', 'rebel'],
        ['yoda', 'luke', 'princess', 'leia'],
        ['death', 'star', 'empire', 'hope'],
      ],
      'POKEMON': [
        ['pikachu', 'catch', 'trainer', 'battle'],
        ['ash', 'gym', 'evolution', 'pokeball'],
        ['gotta', 'catch', 'em', 'all'],
        ['monster', 'creature', 'adventure', 'friend'],
      ],
    };

    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickInputType = (): 'word' | 'phrase' => (Math.random() < 0.5 ? 'word' : 'phrase');

    const category = pickRandom(categories);
    let inputType: 'word' | 'phrase' = req.body?.data?.inputType || pickInputType();
    let recommendations: string[] = [];
    let synonyms: string[][] = [];

    try {
      const recResult = await fetchGeminiRecommendations(createContext(), category, inputType, 10);
      if (recResult.success && recResult.recommendations?.length) {
        recommendations = recResult.recommendations;
      } else {
        throw new Error('API failed');
      }
    } catch {
      const categoryData = fallbackData[category] || fallbackData['Viral Vibes'];
      const selectedData = (categoryData as any)[inputType];
      if (selectedData && selectedData.length > 0) {
        recommendations = selectedData;
      } else {
        recommendations = categoryData['word'];
        inputType = 'word';
      }
    }

    const word = recommendations[0];
    const actualInputType = word.includes(' ') ? 'phrase' : 'word';
    inputType = actualInputType;

    try {
      const synResult = await fetchGeminiSynonyms(createContext(), word);
      if (synResult.success && synResult.synonyms?.length) {
        synonyms = synResult.synonyms;
      } else {
        throw new Error('API failed');
      }
    } catch {
      synonyms = (fallbackSynonyms as any)[word.toUpperCase()] || [
        ['think', 'guess', 'solve', 'answer'],
        ['brain', 'mind', 'logic', 'reason'],
        ['puzzle', 'mystery', 'riddle', 'challenge'],
        ['find', 'discover', 'reveal', 'uncover'],
      ];
    }

    const gifUrls: string[] = [];
    const gifDescriptions: string[] = [];
    const gifSearchTerms: string[] = [];

    for (const synonymGroup of synonyms) {
      if (gifUrls.length >= 4) break;
      const term = synonymGroup[0];
      const gifs = await searchGiphyGifs(createContext(), term, 1);
      if (gifs[0]) {
        const gifUrl = gifs[0].media_formats?.tinygif?.url;
        const gifDescription = gifs[0].content_description || gifs[0].title || term;
        if (gifUrl) {
          gifUrls.push(gifUrl);
          gifDescriptions.push(gifDescription);
          gifSearchTerms.push(term);
        }
      }
    }

    if (gifUrls.length !== 4) {
      res.json({ status: 'error: insufficient gifs' });
      return;
    }

    const validation = await validateGifWordMatch(
      { word, gifDescriptions, searchTerms: gifSearchTerms },
      createContext()
    );

    if (!validation.isValid || validation.matchScore < 0.5) {
      res.json({ status: 'error: validation failed' });
      return;
    }

    const maskedWord = word
      .split('')
      .map((c) => (Math.random() < 0.66 && c !== ' ' ? '_' : c))
      .join('');

    const questionText =
      inputType === 'phrase'
        ? 'Can you decode the phrase from this GIF?'
        : 'Can you decode the word from this GIF?';

    await saveGame(
      {
        word,
        maskedWord,
        category,
        questionText,
        gifs: gifUrls,
        postToSubreddit: true,
        inputType,
        forceUsername: 'gif-enigma',
      },
      createContext()
    );

    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

app.post('/internal/scheduler/clean-leaderboards', async (_req: any, res: any) => {
  try {
    // Auto-scheduler - do NOT include test accounts
    await removeSystemUsersFromLeaderboard(createContext(), false);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

app.post('/internal/scheduler/cache-prewarmer', async (req: any, res: any) => {
  try {
    const runPreGen = req.body?.data?.runPreGen !== false;
    const force = req.body?.data?.force || false;

    if (runPreGen) {
      const { preGenerateItems } = await import('../../game/server/dailyPreGenerator.js');
      await preGenerateItems(createContext(), force);
    } else {
      const { preWarmCache } = await import('../../game/server/cachePreWarmer.js');
      await preWarmCache(createContext());
    }

    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

app.post(
  '/internal/menu/create-gif-enigma',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      const post = await reddit.submitCustomPost({
        subredditName: subreddit.name,
        title: '🎮 GIF Enigma',
        entry: 'landing',
        runAs: 'APP',
      });

      res.json({
        showToast: 'Created new GIF Enigma post!',
        navigateTo: post.url,
      });
    } catch (error) {
      res.json({ showToast: '❌ Failed to create GIF Enigma post' });
    }
  }
);

app.post(
  '/internal/menu/trigger-word-post',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      // Force-create a word-based post (bypasses time/subreddit checks)
      const categories: CategoryType[] = [
        'Cinematic Feels',
        'Gaming Moments',
        'Story Experiences',
        'Viral Vibes',
      ];
      const fallbackData: Record<CategoryType, { word: string[]; phrase: string[] }> = {
        'Cinematic Feels': {
          word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN'],
          phrase: ['MAY THE FORCE BE WITH YOU', 'TO INFINITY AND BEYOND'],
        },
        'Gaming Moments': {
          word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE'],
          phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE'],
        },
        'Story Experiences': {
          word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA'],
          phrase: ['ONCE UPON A TIME', 'THE END', 'TO BE CONTINUED'],
        },
        'Viral Vibes': {
          word: ['RICKROLL', 'CRINGE', 'AWKWARD', 'HYPE', 'SHOCKED'],
          phrase: ['MIC DROP', 'SIDE EYE', 'PLOT TWIST', 'GLOW UP'],
        },
      };
      const fallbackSynonyms: Record<string, string[][]> = {
        STARWARS: [
          ['space', 'lightsaber', 'force', 'jedi'],
          ['galaxy', 'darth', 'vader', 'rebel'],
          ['yoda', 'luke', 'princess', 'leia'],
          ['death', 'star', 'empire', 'hope'],
        ],
        POKEMON: [
          ['pikachu', 'catch', 'trainer', 'battle'],
          ['ash', 'gym', 'evolution', 'pokeball'],
          ['gotta', 'catch', 'em', 'all'],
          ['monster', 'creature', 'adventure', 'friend'],
        ],
      };

      const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const category = pickRandom(categories);
      const inputType: 'word' | 'phrase' = 'word';
      let recommendations: string[] = [];
      let synonyms: string[][] = [];

      try {
        const recResult = await fetchGeminiRecommendations(
          createContext(),
          category,
          inputType,
          10
        );
        if (recResult.success && recResult.recommendations?.length) {
          recommendations = recResult.recommendations;
        } else {
          throw new Error('API failed');
        }
      } catch {
        const categoryData = fallbackData[category] || fallbackData['Viral Vibes'];
        recommendations = categoryData.word;
      }

      const word = recommendations[0];

      try {
        const synResult = await fetchGeminiSynonyms(createContext(), word);
        if (synResult.success && synResult.synonyms?.length) {
          synonyms = synResult.synonyms;
        } else {
          throw new Error('API failed');
        }
      } catch {
        synonyms = (fallbackSynonyms as any)[word.toUpperCase()] || [
          ['think', 'guess', 'solve', 'answer'],
          ['brain', 'mind', 'logic', 'reason'],
          ['puzzle', 'mystery', 'riddle', 'challenge'],
          ['find', 'discover', 'reveal', 'uncover'],
        ];
      }

      const gifUrls: string[] = [];
      const gifDescriptions: string[] = [];
      const gifSearchTerms: string[] = [];

      for (const synonymGroup of synonyms) {
        if (gifUrls.length >= 4) break;
        const term = synonymGroup[0];
        const gifs = await searchGiphyGifs(createContext(), term, 1);
        if (gifs[0]) {
          const gifUrl = gifs[0].media_formats?.tinygif?.url;
          const gifDescription = gifs[0].content_description || gifs[0].title || term;
          if (gifUrl) {
            gifUrls.push(gifUrl);
            gifDescriptions.push(gifDescription);
            gifSearchTerms.push(term);
          }
        }
      }

      if (gifUrls.length !== 4) {
        res.json({ showToast: '❌ Insufficient GIFs found' });
        return;
      }

      const validation = await validateGifWordMatch(
        { word, gifDescriptions, searchTerms: gifSearchTerms },
        createContext()
      );

      if (!validation.isValid || validation.matchScore < 0.5) {
        res.json({ showToast: '❌ Validation failed' });
        return;
      }

      const maskedWord = word
        .split('')
        .map((c) => (Math.random() < 0.66 && c !== ' ' ? '_' : c))
        .join('');

      const questionText = 'Can you decode the word from this GIF?';

      await saveGame(
        {
          word,
          maskedWord,
          category,
          questionText,
          gifs: gifUrls,
          postToSubreddit: true,
          inputType,
          forceUsername: 'gif-enigma',
        },
        createContext()
      );

      res.json({ showToast: '✅ Word-based game post created!' });
    } catch (error) {
      res.json({ showToast: `❌ Failed: ${String(error)}` });
    }
  }
);

app.post(
  '/internal/menu/trigger-phrase-post',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      // Force-create a phrase-based post (bypasses time/subreddit checks)
      const categories: CategoryType[] = [
        'Cinematic Feels',
        'Gaming Moments',
        'Story Experiences',
        'Viral Vibes',
      ];
      const fallbackData: Record<CategoryType, { word: string[]; phrase: string[] }> = {
        'Cinematic Feels': {
          word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN'],
          phrase: ['MAY THE FORCE BE WITH YOU', 'TO INFINITY AND BEYOND'],
        },
        'Gaming Moments': {
          word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE'],
          phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE'],
        },
        'Story Experiences': {
          word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA'],
          phrase: ['ONCE UPON A TIME', 'THE END', 'TO BE CONTINUED'],
        },
        'Viral Vibes': {
          word: ['RICKROLL', 'CRINGE', 'AWKWARD', 'HYPE', 'SHOCKED'],
          phrase: ['MIC DROP', 'SIDE EYE', 'PLOT TWIST', 'GLOW UP'],
        },
      };
      const fallbackSynonyms: Record<string, string[][]> = {
        STARWARS: [
          ['space', 'lightsaber', 'force', 'jedi'],
          ['galaxy', 'darth', 'vader', 'rebel'],
          ['yoda', 'luke', 'princess', 'leia'],
          ['death', 'star', 'empire', 'hope'],
        ],
        POKEMON: [
          ['pikachu', 'catch', 'trainer', 'battle'],
          ['ash', 'gym', 'evolution', 'pokeball'],
          ['gotta', 'catch', 'em', 'all'],
          ['monster', 'creature', 'adventure', 'friend'],
        ],
      };

      const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const category = pickRandom(categories);
      const inputType: 'word' | 'phrase' = 'phrase';
      let recommendations: string[] = [];
      let synonyms: string[][] = [];

      try {
        const recResult = await fetchGeminiRecommendations(
          createContext(),
          category,
          inputType,
          10
        );
        if (recResult.success && recResult.recommendations?.length) {
          recommendations = recResult.recommendations;
        } else {
          throw new Error('API failed');
        }
      } catch {
        const categoryData = fallbackData[category] || fallbackData['Viral Vibes'];
        recommendations = categoryData.phrase;
      }

      const word = recommendations[0];

      try {
        const synResult = await fetchGeminiSynonyms(createContext(), word);
        if (synResult.success && synResult.synonyms?.length) {
          synonyms = synResult.synonyms;
        } else {
          throw new Error('API failed');
        }
      } catch {
        synonyms = (fallbackSynonyms as any)[word.toUpperCase()] || [
          ['think', 'guess', 'solve', 'answer'],
          ['brain', 'mind', 'logic', 'reason'],
          ['puzzle', 'mystery', 'riddle', 'challenge'],
          ['find', 'discover', 'reveal', 'uncover'],
        ];
      }

      const gifUrls: string[] = [];
      const gifDescriptions: string[] = [];
      const gifSearchTerms: string[] = [];

      for (const synonymGroup of synonyms) {
        if (gifUrls.length >= 4) break;
        const term = synonymGroup[0];
        const gifs = await searchGiphyGifs(createContext(), term, 1);
        if (gifs[0]) {
          const gifUrl = gifs[0].media_formats?.tinygif?.url;
          const gifDescription = gifs[0].content_description || gifs[0].title || term;
          if (gifUrl) {
            gifUrls.push(gifUrl);
            gifDescriptions.push(gifDescription);
            gifSearchTerms.push(term);
          }
        }
      }

      if (gifUrls.length !== 4) {
        res.json({ showToast: '❌ Insufficient GIFs found' });
        return;
      }

      const validation = await validateGifWordMatch(
        { word, gifDescriptions, searchTerms: gifSearchTerms },
        createContext()
      );

      if (!validation.isValid || validation.matchScore < 0.5) {
        res.json({ showToast: '❌ Validation failed' });
        return;
      }

      const maskedWord = word
        .split('')
        .map((c) => (Math.random() < 0.66 && c !== ' ' ? '_' : c))
        .join('');

      const questionText = 'Can you decode the phrase from this GIF?';

      await saveGame(
        {
          word,
          maskedWord,
          category,
          questionText,
          gifs: gifUrls,
          postToSubreddit: true,
          inputType,
          forceUsername: 'gif-enigma',
        },
        createContext()
      );

      res.json({ showToast: '✅ Phrase-based game post created!' });
    } catch (error) {
      res.json({ showToast: `❌ Failed: ${String(error)}` });
    }
  }
);

app.post(
  '/internal/menu/clean-leaderboards',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      // Manual menu action - include test accounts
      await removeSystemUsersFromLeaderboard(createContext(), true);
      res.json({ showToast: 'Leaderboards cleaned of system users!' });
    } catch (error) {
      res.json({ showToast: '❌ Error cleaning leaderboards' });
    }
  }
);

app.post(
  '/internal/menu/trigger-daily-pregen',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      const lastRunKey = 'dailyPreGen:lastRun';
      const lastRunTimestamp = await redis.get(lastRunKey);

      if (lastRunTimestamp) {
        const lastRun = parseInt(lastRunTimestamp);
        const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60);

        if (hoursSinceLastRun < 23) {
          res.json({
            showToast:
              '⏱️ Pre-generator already ran in the last 23 hours. Use Force Regenerate to override!',
          });
          return;
        }
      }

      const { preGenerateItems } = await import('../../game/server/dailyPreGenerator.js');
      await preGenerateItems(createContext(), false);

      res.json({
        showToast: '✅ Pre-generation completed successfully! Fresh data is now cached.',
      });
    } catch (error) {
      res.json({ showToast: '❌ Failed to trigger pre-generation' });
    }
  }
);

app.post(
  '/internal/menu/force-cache-prewarm',
  async (_req: any, res: express.Response<UiResponse>) => {
    try {
      const { preGenerateItems } = await import('../../game/server/dailyPreGenerator.js');
      await preGenerateItems(createContext(), true);

      res.json({
        showToast: '✅ Pre-generation completed successfully! Fresh data is now cached.',
      });
    } catch (error) {
      res.json({ showToast: '❌ Failed to trigger pre-generation' });
    }
  }
);

app.post('/internal/menu/toggle-debug', async (_req: any, res: express.Response<UiResponse>) => {
  try {
    const currentState = await redis.get('debugMode');
    const newState = currentState === 'true' ? 'false' : 'true';
    await redis.set('debugMode', newState);

    res.json({
      showToast: `Debug mode ${newState === 'true' ? 'enabled ✅' : 'disabled ❌'}`,
    });
  } catch (error) {
    res.json({ showToast: '❌ Failed to toggle debug mode' });
  }
});

// Global error handler - ensure all responses are JSON
app.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || String(err),
  });
});

const server = createServer(app);
server.listen(getServerPort());

export default server;
