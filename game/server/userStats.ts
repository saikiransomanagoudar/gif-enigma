// server/userStats.ts
import { Context } from '@devvit/public-api';
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

/**
 * Server-side block to manage user statistics
 */
export async function userStats(params: StatsParams, context: Context): Promise<UserStats | null> {
  try {
    const { reddit, kvStore } = context;
    const currentUser = await reddit.getCurrentUser();
    
    if (!currentUser) {
      return null;
    }
    
    const userId = currentUser.username;
    const userStatsKey = `stats:${userId}`;
    
    // Get current stats
    let stats = await kvStore.get<UserStats>(userStatsKey) || { ...DEFAULT_STATS };
    
    if (params.action === 'recordGame') {
      const { won = false, score = 0 } = params;
      
      // Update stats
      stats.gamesPlayed += 1;
      
      if (won) {
        stats.gamesWon += 1;
        stats.totalScore += score;
        stats.averageScore = stats.totalScore / stats.gamesWon;
        
        // Update best score if this score is higher
        stats.bestScore = Math.max(stats.bestScore, score);
      }
      
      // Save updated stats
      await kvStore.put(userStatsKey, stats);
      
      return stats;
    } else if (params.action === 'getStats') {
      return stats;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}