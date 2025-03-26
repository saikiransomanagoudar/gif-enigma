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

  // Calculate GIF hint penalty
  if (gifHintCount >= 2) {
    gifPenalty += 10;
  }
  if (gifHintCount >= 3) {
    gifPenalty += 10; // Total: 20
  }
  if (gifHintCount >= 4) {
    gifPenalty += 20; // Total: 40
  }

  // Calculate Word/Phrase hint penalty based on revealed letters
  if (revealedLetterCount > 0) {
    if (wordLength >= 5 && wordLength <= 7) {
      // 50 points reduction per reveal (2 letters each)
      wordPenalty = Math.min(50, Math.ceil(revealedLetterCount / 2) * 50);
    } else if (wordLength >= 8 && wordLength <= 10) {
      // 25 points reduction per reveal (2 letters each)
      wordPenalty = Math.min(50, Math.ceil(revealedLetterCount / 2) * 25);
    } else if (wordLength >= 11 && wordLength <= 15) {
      // 15 points reduction per reveal (2 letters each)
      wordPenalty = Math.min(45, Math.ceil(revealedLetterCount / 2) * 15);
    } else if (wordLength >= 16) {
      // 10 points reduction per reveal (3 letters each)
      wordPenalty = Math.min(30, Math.ceil(revealedLetterCount / 3) * 10);
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
