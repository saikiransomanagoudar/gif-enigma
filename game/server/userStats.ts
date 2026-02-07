import type { Context } from '@devvit/web/server';
import { reddit, redis } from '@devvit/web/server';
import { UserStats } from '../lib/types.js';

interface StatsParams {
  action: 'recordGame' | 'getStats';
  won?: boolean;
  score?: number;
}

const DEFAULT_STATS: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesCreated: 0,
  bestScore: 0,
  averageScore: 0,
  totalScore: 0,
  hintsUsed: 0
};


export async function userStats(params: StatsParams, _context: Context): Promise<UserStats | null> {
  try {
    const currentUser = await reddit.getCurrentUser();
    
    if (!currentUser) {
      return null;
    }
    
    const userId = currentUser.username;
    const userStatsKey = `stats:${userId}`;
    
    // Get current stats from Redis
    const statsStr = await redis.get(userStatsKey);
    let stats: UserStats = statsStr ? JSON.parse(statsStr) : { ...DEFAULT_STATS };
    
    if (params.action === 'recordGame') {
      const { won = false, score = 0 } = params;
      
      // Update stats
      stats.gamesPlayed += 1;
      
      if (won) {
        stats.gamesWon += 1;
        stats.totalScore += score;
        stats.averageScore = stats.totalScore / stats.gamesWon;
        stats.bestScore = Math.max(stats.bestScore, score);
      }

      // Save updated stats to Redis
      await redis.set(userStatsKey, JSON.stringify(stats));
      
      return stats;
    } else if (params.action === 'getStats') {
      return stats;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}