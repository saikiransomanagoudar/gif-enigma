import { Context } from '@devvit/public-api';
import { ScoreData, LeaderboardEntry } from '../lib/types';

// Bonus XP awarded for creating a game
export const CREATION_BONUS_XP = 20;

//Calculate score based on the game state and user actions
export function calculateScore(params: {
  word: string;
  gifHintCount: number;
  revealedLetterCount: number;
  timeTaken: number; // in seconds
}): {
  score: number;
  gifPenalty: number;
  wordPenalty: number;
  timeTaken: number; // Add this to return type
} {
  const { word, gifHintCount, revealedLetterCount, timeTaken } = params;

  // Clean the word (remove spaces) to get actual length for scoring
  const cleanWord = word.replace(/\s+/g, '');
  const wordLength = cleanWord.length;

  // Base score is 100
  let score = 100;
  let gifPenalty = 0;
  let wordPenalty = 0;

  if (gifHintCount >= 2) {
    if (gifHintCount === 2) {
      gifPenalty = 10;
    } else if (gifHintCount === 3) {
      gifPenalty = 20;
    } else if (gifHintCount >= 4) {
      gifPenalty = 40;
    }
  }

  // Word/Phrase Hint Reveal Penalties based on word length
  if (revealedLetterCount > 0 && wordLength >= 5) {
    let hintsUsed = 0;
    let lettersPerHint = 2; // Default for most cases

    if (wordLength >= 5 && wordLength <= 7) {
      // 5-7 characters: 1 hint available, 2 letters per reveal, 50 points penalty
      lettersPerHint = 2;
      hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
      wordPenalty = hintsUsed * 50;
    } else if (wordLength >= 8 && wordLength <= 10) {
      // 8-10 characters: 2 hints available, 2 letters per reveal, 25 points penalty
      lettersPerHint = 2;
      hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
      wordPenalty = hintsUsed * 25;
    } else if (wordLength >= 11 && wordLength <= 15) {
      // 11-15 characters: 3 hints available, 2 letters per reveal, 15 points penalty
      lettersPerHint = 2;
      hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
      wordPenalty = hintsUsed * 15;
    } else if (wordLength >= 16 && wordLength <= 25) {
      // 16-25 characters: 3 hints available, 3 letters per reveal, 10 points penalty
      lettersPerHint = 3;
      hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
      wordPenalty = hintsUsed * 10;
    }
  }

  // Apply penalties
  score = Math.max(0, score - gifPenalty - wordPenalty);

  return { score, gifPenalty, wordPenalty, timeTaken };
}

// Save a user's score to Redis
export async function saveScore(
  params: ScoreData,
  context: Context
): Promise<{ success: boolean; error?: string }> {
  try {
    const { username, gameId, score, gifPenalty, wordPenalty, timeTaken, timestamp } = params;

    if (!username || !gameId) {
      return { success: false, error: 'Username and Game ID are required' };
    }

    // Don't save scores for anonymous users
    if (username.toLowerCase() === 'anonymous') {
      return { success: false, error: 'Anonymous users cannot save scores' };
    }

    // Store user score for this game in a hash
    await context.redis.hSet(`score:${gameId}:${username}`, {
      username: username,
      gameId,
      score: score.toString(),
      gifPenalty: gifPenalty.toString(),
      wordPenalty: wordPenalty.toString(),
      timeTaken: timeTaken.toString(),
      timestamp: timestamp.toString(),
    });

    // Add to game's leaderboard sorted set (higher scores first)
    await context.redis.zAdd(`leaderboard:${gameId}`, {
      score: score,
      member: username,
    });

    // Add to global leaderboard (higher scores first)
    await context.redis.zAdd('globalLeaderboard', {
      score: score,
      member: `${gameId}:${username}`,
    });

    // -------- Begin Cumulative Leaderboard Additions --------

    // Track that this user completed this game
    await context.redis.zAdd(`user:${username}:completedGames`, {
      member: gameId,
      score: timestamp,
    });

    

    // Update user stats
    try {
      // Get existing user stats
      let userStats: { gamesPlayed?: string; gamesWon?: string; totalScore?: string; bestScore?: string; averageScore?: string; lastPlayed?: string } = await context.redis.hGetAll(`userStats:${username}`).catch(() => ({}));
      if (!userStats || typeof userStats !== 'object') {
        await context.redis.del(`userStats:${username}`);
      }
      if (!userStats || Object.keys(userStats).length === 0) {
        await context.redis.hSet(`userStats:${username}`, {
          gamesPlayed: '0',
          gamesCreated: '0',
          totalScore: '0',
          bestScore: '0',
          averageScore: '0'
        });
        userStats = await context.redis.hGetAll(`userStats:${username}`);
      }
      

      // Calculate new stats
      const gamesPlayed = Number(userStats.gamesPlayed || 0) + 1;
      const gamesWon = Number(userStats.gamesWon || 0) + 1; // Assuming a score means they won
      const totalScore = Number(userStats.totalScore || 0) + score;
      const bestScore = Math.max(Number(userStats.bestScore || 0), score);
      const averageScore = Math.round(totalScore / gamesPlayed);

      // Save updated stats
      await context.redis.hSet(`userStats:${username}`, {
        gamesPlayed: gamesPlayed.toString(),
        gamesWon: gamesWon.toString(),
        totalScore: totalScore.toString(),
        bestScore: bestScore.toString(),
        averageScore: averageScore.toString(),
        lastPlayed: timestamp.toString(),
      });

      // Update cumulative leaderboard
      await context.redis.zIncrBy('cumulativeLeaderboard', username, score);

    } catch (statsError) {
      // Continue with the function even if user stats update fails
    }

    // -------- End Cumulative Leaderboard Additions --------

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get game leaderboard from Redis
export async function getGameLeaderboard(
  params: { gameId: string; limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { gameId, limit = 10 } = params;

    // Get top scores from game's leaderboard (highest scores first)
    const leaderboardItems = await context.redis.zRange(`leaderboard:${gameId}`, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    if (!leaderboardItems || leaderboardItems.length === 0) {
      return { success: true, leaderboard: [] };
    }

    // Build leaderboard with user details
    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < leaderboardItems.length; i++) {
      const item = leaderboardItems[i];
      const username = typeof item.member === 'string' ? item.member : '';

      try {
        // Get score details
        const scoreData = await context.redis.hGetAll(`score:${gameId}:${username}`);

        if (!scoreData || Object.keys(scoreData).length === 0) {
          continue;
        }

        leaderboard.push({
          rank: i + 1,
          username: username,
          score: Number(scoreData?.score || item.score),
          gifPenalty: Number(scoreData?.gifPenalty || 0),
          wordPenalty: Number(scoreData?.wordPenalty || 0),
          timeTaken: Number(scoreData?.timeTaken || 0),
          timestamp: Number(scoreData?.timestamp || 0),
        });
      } catch (entryError) {
      }
    }

    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get global leaderboard from Redis
export async function getGlobalLeaderboard(
  params: { limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { limit = 10 } = params;

    // Get top scores from global leaderboard
    const leaderboardItems = await context.redis.zRange('globalLeaderboard', 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    if (!leaderboardItems || leaderboardItems.length === 0) {
      return { success: true, leaderboard: [] };
    }

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < leaderboardItems.length; i++) {
      const item = leaderboardItems[i];
      const combinedId = typeof item.member === 'string' ? item.member : '';
      const [gameId, username] = combinedId.split(':');

      if (!gameId || !username) continue;

      const scoreData = await context.redis.hGetAll(`score:${gameId}:${username}`);

      leaderboard.push({
        rank: i + 1,
        username: username,
        score: Number(scoreData.score || item.score),
        gifPenalty: Number(scoreData.gifPenalty || 0),
        wordPenalty: Number(scoreData.wordPenalty || 0),
        timeTaken: Number(scoreData.timeTaken || 0),
        timestamp: Number(scoreData.timestamp || 0),
      });
    }

    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get user's scores from Redis
export async function getUserScores(
  params: { username: string; limit?: number },
  context: Context
): Promise<{ success: boolean; scores?: ScoreData[]; error?: string }> {
  try {
    const { username, limit = 10 } = params;

    // Get user's scores (highest scores first)
    const scoreItems = await context.redis.zRange(`user:${username}:scores`, 0, limit - 1, {
      reverse: true, // High scores first
      by: 'rank',
    });

    if (!scoreItems || scoreItems.length === 0) {
      return { success: true, scores: [] };
    }

    // Build score list
    const scores: ScoreData[] = [];

    for (const item of scoreItems) {
      const gameId = typeof item.member === 'string' ? item.member : '';
      const score = item.score;

      // Get score details
      const scoreData = await context.redis.hGetAll(`score:${gameId}:${username}`);

      if (!scoreData || Object.keys(scoreData).length === 0) {
        continue;
      }

      scores.push({
        username,
        gameId,
        score: Number(scoreData.score || score),
        gifPenalty: Number(scoreData.gifPenalty || 0),
        wordPenalty: Number(scoreData.wordPenalty || 0),
        timeTaken: Number(scoreData.timeTaken || 0),
        timestamp: Number(scoreData.timestamp || 0),
      });
    }

    return { success: true, scores };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getCumulativeLeaderboard(
  params: { limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { limit = 10 } = params;

    // Get top users from cumulative leaderboard
    const leaderboardItems = await context.redis.zRange('cumulativeLeaderboard', 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    if (!leaderboardItems || leaderboardItems.length === 0) {
      return { success: true, leaderboard: [] };
    }

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < leaderboardItems.length; i++) {
      const item = leaderboardItems[i];
      const username = typeof item.member === 'string' ? item.member : '';

      // Skip anonymous users
      if (!username || username.toLowerCase() === 'anonymous') {
        continue;
      }

      // Get user stats
      const userStats = await context.redis.hGetAll(`userStats:${username}`) || {};

      if (!userStats || Object.keys(userStats).length === 0) {
        continue;
      }

      if (!userStats || typeof userStats !== 'object') {
        return { success: false, error: 'Invalid user data format' };
      }

      leaderboard.push({
        rank: leaderboard.length + 1,
        username: username,
        score: Number(userStats.totalScore ?? item.score),
        gamesPlayed: Number(userStats.gamesPlayed || 0),
        gamesWon: Number(userStats.gamesWon || 0),
        gamesCreated: Number(userStats.gamesCreated || 0),
        bestScore: Number(userStats.bestScore || 0),
        averageScore: Number(userStats.averageScore || 0),
        timestamp: Number(userStats.lastPlayed || 0),
      });
    }

    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function awardCreationBonus(
  username: string,
  context: Context
): Promise<{ success: boolean; error?: string; bonusAwarded?: boolean }> {
  try {
    // Check how many games the user has created in the last 24 hours
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000); // 24 hours in milliseconds
    
    // Track recent game creations in a sorted set with timestamp as score
    const recentCreationsKey = `user:${username}:recentCreations`;
    
    // Get all game creations in the last 24 hours
    const recentCreations = await context.redis.zRange(recentCreationsKey, 0, -1, {
      by: 'rank',
    });
    
    // Filter creations to only include those in the last 24 hours
    const creationsInLast24h = recentCreations.filter((item) => {
      return item.score >= twentyFourHoursAgo;
    });
    
    // Add current creation to the set
    await context.redis.zAdd(recentCreationsKey, {
      member: `game_${now}`,
      score: now,
    });
    
    // Clean up old entries (older than 24 hours)
    await context.redis.zRemRangeByScore(recentCreationsKey, 0, twentyFourHoursAgo);
    const shouldAwardBonus = creationsInLast24h.length < 4;
    
    // Get or initialize user stats
    let userStats: any = await context.redis.hGetAll(`userStats:${username}`).catch(() => ({}));
    
    if (!userStats || Object.keys(userStats).length === 0) {
      await context.redis.hSet(`userStats:${username}`, {
        gamesPlayed: '0',
        gamesCreated: '0',
        totalScore: '0',
        bestScore: '0',
        averageScore: '0'
      });
      userStats = await context.redis.hGetAll(`userStats:${username}`);
    }
    
    // Update games created count (always increment this)
    const gamesCreated = Number(userStats.gamesCreated || 0) + 1;
    
    // Only award bonus if user hasn't exceeded the 4 games limit in 24 hours
    let bonusXP = 0;
    if (shouldAwardBonus) {
      bonusXP = CREATION_BONUS_XP;
    }
    
    const totalScore = Number(userStats.totalScore || 0) + bonusXP;
    
    await context.redis.hSet(`userStats:${username}`, {
      ...userStats,
      gamesCreated: gamesCreated.toString(),
      totalScore: totalScore.toString(),
      lastPlayed: Date.now().toString(),
    });
    
    // Update cumulative leaderboard with bonus (only if bonus was awarded)
    if (shouldAwardBonus) {
      await context.redis.zIncrBy('cumulativeLeaderboard', username, CREATION_BONUS_XP);
    }
    
    return { success: true, bonusAwarded: shouldAwardBonus };
  } catch (error) {
    return { success: false, error: String(error), bonusAwarded: false };
  }
}