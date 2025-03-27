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

  // Fetch leaderboard data
  // In useLeaderboard.ts
  const fetchLeaderboards = useCallback(() => {
    console.log('useLeaderboard: Fetching leaderboard data...');
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Use window.postMessage directly
    console.log('useLeaderboard: Sending GET_GLOBAL_LEADERBOARD message');
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

    console.log('useLeaderboard: Sending GET_CUMULATIVE_LEADERBOARD message');
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

  // Initial fetch
  useEffect(() => {
    console.log('useLeaderboard: Initial fetch triggered');
    fetchLeaderboards();
  }, [fetchLeaderboards]);

  // Auto refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    console.log(`useLeaderboard: Setting up auto-refresh every ${refreshInterval}ms`);
    const intervalId = setInterval(() => {
      fetchLeaderboards();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchLeaderboards]);

  // Handle messages
  useEffect(() => {
    console.log('useLeaderboard: Setting up message listener');

    const handleMessage = (event: MessageEvent) => {
      console.log('LEADERBOARD-RAW:', event.data);
      // Unwrap devvit-message (same as your snippet)
      let msg = event.data;
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
        console.log('LEADERBOARD-UNWRAPPED-1:', msg);
      } else if (msg?.type === 'devvit-message') {
        msg = msg.data;
        console.log('LEADERBOARD-UNWRAPPED-2:', msg);
      }
      console.log('LEADERBOARD-FINAL:', msg?.type);
      if (!msg || typeof msg !== 'object') return;
      

      console.log('useLeaderboard: Received unwrapped message:', msg.type);

      // Handle global leaderboard response
      if (msg.type === 'GET_GLOBAL_LEADERBOARD_RESULT') {
        console.log('useLeaderboard: Processing global leaderboard result:', msg.success);
        if (msg.success) {
          setState((prev) => ({
            ...prev,
            globalLeaderboard: msg.result?.leaderboard || [],
            isLoading: prev.cumulativeLeaderboard.length === 0, // Only stop loading if both are done
          }));
        } else {
          console.error('useLeaderboard: Global leaderboard error:', msg.error);
          setState((prev) => ({
            ...prev,
            error: msg.error || 'Failed to fetch global leaderboard',
            isLoading: false,
          }));
        }
      }

      // Handle cumulative leaderboard response
      if (msg.type === 'GET_CUMULATIVE_LEADERBOARD_RESULT') {
        console.log('useLeaderboard: Processing cumulative leaderboard result:', msg.success);
        if (msg.success) {
          const cumulativeData = msg.result?.leaderboard || [];
          let userStats = null;

          // Find current user's stats
          if (username) {
            console.log(`useLeaderboard: Looking for user ${username} in leaderboard`);
            userStats =
              cumulativeData.find((entry: LeaderboardEntry) => entry.username === username) || null;
            if (userStats) {
              console.log('useLeaderboard: Found user stats:', userStats);
            } else {
              console.log('useLeaderboard: User not found in leaderboard');
            }
          }

          setState((prev) => ({
            ...prev,
            cumulativeLeaderboard: cumulativeData,
            userStats,
            isLoading: prev.globalLeaderboard.length === 0, // Only stop loading if both are done
          }));
        } else {
          console.error('useLeaderboard: Cumulative leaderboard error:', msg.error);
          setState((prev) => ({
            ...prev,
            error: msg.error || 'Failed to fetch cumulative leaderboard',
            isLoading: false,
          }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('useLeaderboard: Message listener registered');

    return () => {
      console.log('useLeaderboard: Removing message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [username]);

  // Return data and methods
  return {
    ...state,
    refresh: fetchLeaderboards,
  };
};

export default useLeaderboard;
