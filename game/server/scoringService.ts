import { Context } from '@devvit/public-api';
import { ScoreData, LeaderboardEntry } from '../lib/types';

/**
 * Calculate score based on the game state and user actions
 */
// Update the calculateScore function in scoringService.ts
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

  // Update the word penalty section in calculateScore
  if (revealedLetterCount > 0 && wordLength >= 5) {
    let hintsUsed = 0;

    if (wordLength <= 7) {
      hintsUsed = Math.ceil(revealedLetterCount / 2);
      wordPenalty = hintsUsed * 50;
    } else if (wordLength <= 10) {
      hintsUsed = Math.ceil(revealedLetterCount / 2);
      wordPenalty = hintsUsed * 25;
    } else if (wordLength <= 15) {
      hintsUsed = Math.ceil(revealedLetterCount / 2);
      wordPenalty = hintsUsed * 15;
    } else {
      hintsUsed = Math.ceil(revealedLetterCount / 3);
      wordPenalty = hintsUsed * 10;
    }
  }

  // Apply penalties
  score = Math.max(0, score - gifPenalty - wordPenalty);

  // Apply small time penalty (1 point per minute, max 10 points)
  const timePenalty = Math.min(10, Math.floor(timeTaken / 60));
  score = Math.max(0, score - timePenalty);

  // Return the score, penalties AND the timeTaken
  return { score, gifPenalty, wordPenalty, timeTaken };
}

/**
 * Save a user's score to Redis
 */
export async function saveScore(
  params: ScoreData,
  context: Context
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔍 [DEBUG] saveScore called with params:', params);
    const { username, gameId, score, gifPenalty, wordPenalty, timeTaken, timestamp } = params;

    if (!username || !gameId) {
      return { success: false, error: 'Username and Game ID are required' };
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
      const userStats = await context.redis.hGetAll(`userStats:${username}`);

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
      await context.redis.zAdd('cumulativeLeaderboard', {
        score: totalScore,
        member: username,
      });

      console.log(`✅ [DEBUG] Updated user stats for ${username}, total score: ${totalScore}`);
    } catch (statsError) {
      console.error(`❌ [DEBUG] Error updating user stats for ${username}:`, statsError);
      // Continue with the function even if user stats update fails
    }

    // -------- End Cumulative Leaderboard Additions --------

    console.log('✅ [DEBUG] Score saved successfully for user:', username);
    return { success: true };
  } catch (error) {
    console.error('❌ [DEBUG] Error saving score:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get game leaderboard from Redis
 */
export async function getGameLeaderboard(
  params: { gameId: string; limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    console.log('🔍 [DEBUG] getGameLeaderboard called with params:', params);
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
          score: Number(scoreData.score || item.score),
          gifPenalty: Number(scoreData.gifPenalty || 0),
          wordPenalty: Number(scoreData.wordPenalty || 0),
          timeTaken: Number(scoreData.timeTaken || 0),
          timestamp: Number(scoreData.timestamp || 0),
        });
      } catch (entryError) {
        console.error(`❌ [DEBUG] Error processing entry for ${username}:`, entryError);
      }
    }

    return { success: true, leaderboard };
  } catch (error) {
    console.error('❌ [DEBUG] Error getting game leaderboard:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get global leaderboard from Redis
 */
export async function getGlobalLeaderboard(
  params: { limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    console.log('🔍 [DEBUG] getGlobalLeaderboard called with params:', params);
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

      try {
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
      } catch (entryError) {
        console.error(`❌ [DEBUG] Error processing entry ${combinedId}:`, entryError);
      }
    }

    return { success: true, leaderboard };
  } catch (error) {
    console.error('❌ [DEBUG] Error getting global leaderboard:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get user's scores from Redis
 */
export async function getUserScores(
  params: { username: string; limit?: number },
  context: Context
): Promise<{ success: boolean; scores?: ScoreData[]; error?: string }> {
  try {
    console.log('🔍 [DEBUG] getUserScores called with params:', params);
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
    console.error('❌ [DEBUG] Error getting user scores:', error);
    return { success: false, error: String(error) };
  }
}

export async function getCumulativeLeaderboard(
  params: { limit?: number },
  context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    console.log('🔍 [DEBUG] getCumulativeLeaderboard called with params:', params);
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

      try {
        // Get user stats
        const userStats = await context.redis.hGetAll(`userStats:${username}`);

        if (!userStats || Object.keys(userStats).length === 0) {
          continue;
        }

        leaderboard.push({
          rank: i + 1,
          username: username,
          score: Number(userStats.totalScore || item.score),
          gamesPlayed: Number(userStats.gamesPlayed || 0),
          gamesWon: Number(userStats.gamesWon || 0),
          bestScore: Number(userStats.bestScore || 0),
          averageScore: Number(userStats.averageScore || 0),
          timestamp: Number(userStats.lastPlayed || 0),
        });
      } catch (entryError) {
        console.error(`❌ [DEBUG] Error processing entry for ${username}:`, entryError);
      }
    }

    return { success: true, leaderboard };
  } catch (error) {
    console.error('❌ [DEBUG] Error getting cumulative leaderboard:', error);
    return { success: false, error: String(error) };
  }
}
