import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry } from './types';

export interface LeaderboardState {
  globalLeaderboard: LeaderboardEntry[];
  cumulativeLeaderboard: LeaderboardEntry[];
  userStats: LeaderboardEntry | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseLeaderboardOptions {
  limit?: number;
  postMessage?: (message: any) => void;
  username?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useLeaderboard = ({
  limit = 20,
  username,
  autoRefresh = false,
  refreshInterval = 60000,
}: UseLeaderboardOptions) => {
  const [state, setState] = useState<LeaderboardState>({
    globalLeaderboard: [],
    cumulativeLeaderboard: [],
    userStats: null,
    isLoading: true,
    error: null,
  });

  const fetchLeaderboards = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    window.parent.postMessage(
      {
        type: 'devvit-message',
        data: {
          type: 'GET_GLOBAL_LEADERBOARD',
          data: { limit },
        },
      },
      '*'
    );

    window.parent.postMessage(
      {
        type: 'devvit-message',
        data: {
          type: 'GET_CUMULATIVE_LEADERBOARD',
          data: { limit },
        },
      },
      '*'
    );
  }, [limit]);

  useEffect(() => {
    fetchLeaderboards();
  }, [fetchLeaderboards]);

  // Auto refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = setInterval(() => {
      fetchLeaderboards();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchLeaderboards]);

  // Handle messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      } else if (msg?.type === 'devvit-message') {
        msg = msg.data;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'GET_GLOBAL_LEADERBOARD_RESULT') {
        if (msg.success) {
          setState((prev) => ({
            ...prev,
            globalLeaderboard: msg.result?.leaderboard || [],
            isLoading: prev.cumulativeLeaderboard.length === 0, // Only stop loading if both are done
          }));
        } else {
          setState((prev) => ({
            ...prev,
            error: msg.error || 'Failed to fetch global leaderboard',
            isLoading: false,
          }));
        }
      }

      if (msg.type === 'GET_CUMULATIVE_LEADERBOARD_RESULT') {
        if (msg.success) {
          const cumulativeData = msg.result?.leaderboard || [];
          let userStats = null;

          // Find current user's stats
          if (username) {
            userStats =
              cumulativeData.find((entry: LeaderboardEntry) => entry.username === username) || null;
          }

          setState((prev) => ({
            ...prev,
            cumulativeLeaderboard: cumulativeData,
            userStats,
            isLoading: prev.globalLeaderboard.length === 0, // Only stop loading if both are done
          }));
        } else {
          setState((prev) => ({
            ...prev,
            error: msg.error || 'Failed to fetch cumulative leaderboard',
            isLoading: false,
          }));
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [username]);

  return {
    ...state,
    refresh: fetchLeaderboards,
  };
};

export default useLeaderboard;
