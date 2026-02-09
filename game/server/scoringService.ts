import type { Context } from '@devvit/web/server';
import { reddit, redis } from '@devvit/web/server';
import { ScoreData, LeaderboardEntry } from '../lib/types';

// Bonus XP awarded for creating a game
export const CREATION_BONUS_XP = 20;

// Bonus XP awarded to creator
export const CREATOR_COMPLETION_BONUS_XP = 5;

// system/bot usernames
const systemUsernames = [
  'gif-enigma',
  'anonymous',
  'GIFEnigmaBot',
  'system',
  'AutoModerator',
  'reddit',
];

// Calculate score based on the game state and user actions
export function calculateScore(params: {
  word: string;
  gifHintCount: number;
  revealedLetterCount: number;
  timeTaken: number;
}): {
  score: number;
  gifPenalty: number;
  wordPenalty: number;
  timeTaken: number;
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
    let lettersPerHint = 2;

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
  _context: Context
): Promise<{ success: boolean; error?: string }> {
  try {
    const { username, gameId, score, gifPenalty, wordPenalty, timeTaken, timestamp } = params;

    if (!username || !gameId) {
      return { success: false, error: 'Username and Game ID are required' };
    }

    if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
      return { success: false, error: 'System users cannot save scores' };
    }

    const scoreKey = `score:${gameId}:${username}`;
    await redis.hSet(scoreKey, {
      username: username,
      gameId,
      score: score.toString(),
      gifPenalty: gifPenalty.toString(),
      wordPenalty: wordPenalty.toString(),
      timeTaken: timeTaken.toString(),
      timestamp: timestamp.toString(),
    });

    if (score > 0) {
      const leaderboardKey = `leaderboard:${gameId}`;
      await redis.zAdd(leaderboardKey, {
        score: score,
        member: username,
      });

      await redis.zAdd('globalLeaderboard', {
        score: score,
        member: `${gameId}:${username}`,
      });
    }

    if (score > 0) {
      await redis.zAdd(`user:${username}:completedGames`, {
        member: gameId,
        score: timestamp,
      });
    }

    // Get existing user stats
    let userStats: {
      gamesPlayed?: string;
      gamesWon?: string;
      totalScore?: string;
      bestScore?: string;
      averageScore?: string;
      lastPlayed?: string;
      gamesCreated?: string;
    } = await redis.hGetAll(`userStats:${username}`).catch(() => ({}));

    // Ensure userStats is a valid object
    if (!userStats || typeof userStats !== 'object' || Object.keys(userStats).length === 0) {
      userStats = {
        gamesPlayed: '0',
        gamesWon: '0',
        totalScore: '0',
        bestScore: '0',
        averageScore: '0',
        gamesCreated: '0',
        lastPlayed: '0',
      };
    }

    // Calculate new stats
    const gamesPlayed = Number(userStats.gamesPlayed || 0) + 1;
    const gamesWon =
      score > 0 ? Number(userStats.gamesWon || 0) + 1 : Number(userStats.gamesWon || 0); // Only count as won if score > 0
    const totalScore = Number(userStats.totalScore || 0) + score;
    const bestScore = Math.max(Number(userStats.bestScore || 0), score);
    const averageScore = Math.round(totalScore / gamesPlayed);
    const gamesCreated = Number(userStats.gamesCreated || 0);

    // Check if user is a system/bot account
    const isSystemUser = systemUsernames.some(
      (sysUser) => username.toLowerCase() === sysUser.toLowerCase()
    );

    await redis.hSet(`userStats:${username}`, {
      gamesPlayed: gamesPlayed.toString(),
      gamesWon: gamesWon.toString(),
      totalScore: totalScore.toString(),
      bestScore: bestScore.toString(),
      averageScore: averageScore.toString(),
      gamesCreated: gamesCreated.toString(),
      lastPlayed: timestamp.toString(),
    });

    if (score > 0 && !isSystemUser) {
      await redis.zIncrBy('cumulativeLeaderboard', username, score);
    }

    // Invalidate leaderboard cache
    try {
      const cacheKeys = [
        'leaderboard:cumulative:10',
        'leaderboard:cumulative:50',
        'leaderboard:cumulative:100',
      ];
      await Promise.all(cacheKeys.map((key) => redis.del(key).catch(() => {})));
    } catch (cacheError) {
      // Continue even if cache invalidation fails
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getGameLeaderboard(
  params: { gameId: string; limit?: number },
  _context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { gameId, limit = 10 } = params;
    const redisKey = `leaderboard:${gameId}`;
    const leaderboardItems = await redis.zRange(redisKey, 0, limit - 1, {
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
      const scoreData = await redis.hGetAll(`score:${gameId}:${username}`);

      if (!scoreData || Object.keys(scoreData).length === 0) {
        continue;
      }

      // Skip system users
      if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
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
    }

    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getGlobalLeaderboard(
  params: { limit?: number },
  _context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { limit = 10 } = params;
    const leaderboardItems = await redis.zRange('globalLeaderboard', 0, limit - 1, {
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

      // Skip system users
      if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
        continue;
      }

      const scoreData = await redis.hGetAll(`score:${gameId}:${username}`);

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

export async function getUserScores(
  params: { username: string; limit?: number },
  _context: Context
): Promise<{ success: boolean; scores?: ScoreData[]; error?: string }> {
  try {
    const { username, limit = 10 } = params;

    const scoreItems = await redis.zRange(`user:${username}:scores`, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    if (!scoreItems || scoreItems.length === 0) {
      return { success: true, scores: [] };
    }

    const scores: ScoreData[] = [];

    for (const item of scoreItems) {
      const gameId = typeof item.member === 'string' ? item.member : '';
      const score = item.score;
      const scoreData = await redis.hGetAll(`score:${gameId}:${username}`);

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
  _context: Context
): Promise<{ success: boolean; leaderboard?: LeaderboardEntry[]; error?: string }> {
  try {
    const { limit = 10 } = params;
    const cacheKey = `leaderboard:cumulative:${limit}`;
    const cacheTTL = 300;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const leaderboard = JSON.parse(cached) as LeaderboardEntry[];
      return { success: true, leaderboard };
    }

    const leaderboardItems = await redis.zRange('cumulativeLeaderboard', 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    if (!leaderboardItems || leaderboardItems.length === 0) {
      return { success: true, leaderboard: [] };
    }

    const validUsers: Array<{ username: string; item: (typeof leaderboardItems)[0] }> = [];

    for (const item of leaderboardItems) {
      const username = typeof item.member === 'string' ? item.member : '';
      if (!username || username.toLowerCase() === 'anonymous') {
        continue;
      }

      // Skip system users
      if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
        continue;
      }

      validUsers.push({ username, item });
    }

    const leaderboardPromises = validUsers.map(async ({ username, item }) => {
      try {
        const [userStats, snoovatarUrl] = await Promise.all([
          redis.hGetAll(`userStats:${username}`),
          reddit.getSnoovatarUrl(username).catch(() => {
            return undefined;
          }),
        ]);

        if (!userStats || Object.keys(userStats).length === 0) {
          return null;
        }

        return {
          username: username,
          score: Number(userStats.totalScore ?? item.score),
          gamesPlayed: Number(userStats.gamesPlayed || 0),
          gamesWon: Number(userStats.gamesWon || 0),
          gamesCreated: Number(userStats.gamesCreated || 0),
          bestScore: Number(userStats.bestScore || 0),
          snoovatarUrl: snoovatarUrl,
          averageScore: Number(userStats.averageScore || 0),
          timestamp: Number(userStats.lastPlayed || 0),
        } as Omit<LeaderboardEntry, 'rank'>;
      } catch (error) {
        return null;
      }
    });

    const leaderboardResults = await Promise.all(leaderboardPromises);

    const leaderboard: LeaderboardEntry[] = leaderboardResults
      .filter((entry): entry is Omit<LeaderboardEntry, 'rank'> => entry !== null)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    await redis.set(cacheKey, JSON.stringify(leaderboard), {
      expiration: new Date(Date.now() + cacheTTL * 1000),
    });

    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function awardCreationBonus(
  username: string,
  _context: Context
): Promise<{ success: boolean; error?: string; bonusAwarded?: boolean }> {
  try {
    if (systemUsernames.some((sysUser) => username.toLowerCase() === sysUser.toLowerCase())) {
      return { success: true, bonusAwarded: false, error: 'System users do not receive bonuses' };
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const recentCreationsKey = `user:${username}:recentCreations`;

    const recentCreations = await redis.zRange(recentCreationsKey, 0, -1, {
      by: 'rank',
    });

    const creationsInLast24h = recentCreations.filter((item) => {
      return item.score >= twentyFourHoursAgo;
    });

    const shouldAwardBonus = creationsInLast24h.length <= 4;

    let userStats: any = await redis.hGetAll(`userStats:${username}`).catch(() => ({}));

    if (!userStats || Object.keys(userStats).length === 0) {
      await redis.hSet(`userStats:${username}`, {
        gamesPlayed: '0',
        gamesCreated: '0',
        totalScore: '0',
        bestScore: '0',
        averageScore: '0',
      });
      userStats = await redis.hGetAll(`userStats:${username}`);
    }

    const gamesCreated = Number(userStats.gamesCreated || 0) + 1;

    let bonusXP = 0;
    if (shouldAwardBonus) {
      bonusXP = CREATION_BONUS_XP;
    }

    const totalScore = Number(userStats.totalScore || 0) + bonusXP;

    await redis.hSet(`userStats:${username}`, {
      ...userStats,
      gamesCreated: gamesCreated.toString(),
      totalScore: totalScore.toString(),
      creatorBonusEarned: (Number(userStats.creatorBonusEarned || 0) + bonusXP).toString(),
      lastPlayed: Date.now().toString(),
    });

    if (shouldAwardBonus) {
      await redis.zIncrBy('cumulativeLeaderboard', username, CREATION_BONUS_XP);
      const cacheKeys = [
        'leaderboard:cumulative:10',
        'leaderboard:cumulative:50',
        'leaderboard:cumulative:100',
      ];
      await Promise.all(cacheKeys.map((key) => redis.del(key).catch(() => {})));
    }

    return { success: true, bonusAwarded: shouldAwardBonus };
  } catch (error) {
    return { success: false, error: String(error), bonusAwarded: false };
  }
}

export async function awardCreatorCompletionBonus(
  creatorUsername: string,
  gameId: string,
  completedByUsername: string,
  _context: Context
): Promise<{ success: boolean; error?: string; bonusAwarded?: boolean }> {
  try {
    if (
      systemUsernames.some((sysUser) => creatorUsername.toLowerCase() === sysUser.toLowerCase())
    ) {
      return { success: true, bonusAwarded: false, error: 'System users do not receive bonuses' };
    }

    if (creatorUsername.toLowerCase() === completedByUsername.toLowerCase()) {
      return {
        success: true,
        bonusAwarded: false,
        error: 'Creators cannot earn bonus from their own games',
      };
    }

    if (
      systemUsernames.some((sysUser) => completedByUsername.toLowerCase() === sysUser.toLowerCase())
    ) {
      return {
        success: true,
        bonusAwarded: false,
        error: 'System user completions do not award bonus',
      };
    }

    const creatorBonusKey = `creatorBonus:${gameId}`;
    const alreadyAwarded = await redis.zScore(creatorBonusKey, completedByUsername);

    if (alreadyAwarded !== null && alreadyAwarded !== undefined) {
      return {
        success: true,
        bonusAwarded: false,
        error: 'Bonus already awarded for this completion',
      };
    }

    await redis.zAdd(creatorBonusKey, {
      member: completedByUsername,
      score: Date.now(),
    });

    let creatorStats: any = await redis.hGetAll(`userStats:${creatorUsername}`).catch(() => ({}));

    if (!creatorStats || Object.keys(creatorStats).length === 0) {
      await redis.hSet(`userStats:${creatorUsername}`, {
        gamesPlayed: '0',
        gamesCreated: '0',
        totalScore: '0',
        bestScore: '0',
        averageScore: '0',
        creatorBonusEarned: '0',
      });
      creatorStats = await redis.hGetAll(`userStats:${creatorUsername}`);
    }

    // Award the bonus XP
    const totalScore = Number(creatorStats.totalScore || 0) + CREATOR_COMPLETION_BONUS_XP;
    const creatorBonusEarned =
      Number(creatorStats.creatorBonusEarned || 0) + CREATOR_COMPLETION_BONUS_XP;

    await redis.hSet(`userStats:${creatorUsername}`, {
      ...creatorStats,
      totalScore: totalScore.toString(),
      creatorBonusEarned: creatorBonusEarned.toString(),
      lastPlayed: Date.now().toString(),
    });

    await redis.zIncrBy('cumulativeLeaderboard', creatorUsername, CREATOR_COMPLETION_BONUS_XP);

    const cacheKeys = [
      'leaderboard:cumulative:10',
      'leaderboard:cumulative:50',
      'leaderboard:cumulative:100',
    ];
    await Promise.all(cacheKeys.map((key) => redis.del(key).catch(() => {})));

    return { success: true, bonusAwarded: true };
  } catch (error) {
    return { success: false, error: String(error), bonusAwarded: false };
  }
}

export async function getCreatorBonusStats(
  gameId: string,
  _context: Context
): Promise<{ success: boolean; totalBonus?: number; completions?: number; error?: string }> {
  try {
    const creatorBonusKey = `creatorBonus:${gameId}`;
    const completions = await redis.zCard(creatorBonusKey);
    const totalBonus = completions * CREATOR_COMPLETION_BONUS_XP;

    return { success: true, totalBonus, completions };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
