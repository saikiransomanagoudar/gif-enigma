import React, { useState, useEffect } from 'react';
import { ComicText } from '../lib/fonts';

interface StatItemProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({
  icon,
  label,
  value,
  color = 'text-gray-800 dark:text-white',
}) => (
  <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
    <div className="mb-1 text-xl">{icon}</div>
    <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
      <ComicText size={0.4}>{label}</ComicText>
    </div>
    <div className={`text-lg font-bold ${color}`}>
      <ComicText size={0.7}>{value}</ComicText>
    </div>
  </div>
);

interface UserStatsCardProps {
  username: string;
  stats: {
    bestScore?: number;
    totalScore?: number;
    gamesPlayed?: number;
    gamesWon?: number;
    averageScore?: number;
    rank?: number;
    lastPlayed?: number;
  };
  isLoading?: boolean;
}

export const UserStatsCard: React.FC<UserStatsCardProps> = ({
  username,
  stats,
  isLoading = false,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const formatLastPlayed = () => {
    if (!stats.lastPlayed) return 'Never';
    const date = new Date(stats.lastPlayed);
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-lg shadow-md ${
        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      }`}
    >
      <div className="bg-[#FF4500] px-4 py-3 text-white">
        <div className="flex items-center">
          <span className="mr-2 text-xl">👤</span>
          <div>
            <ComicText size={0.7}>{username}'s Stats</ComicText>
            <div className="text-xs opacity-80">
              <ComicText size={0.4}>Your GIF Enigma performance</ComicText>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <div className="p-4">
          {stats && Object.keys(stats).length > 0 ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatItem
                  icon="🏆"
                  label="Best Score"
                  value={stats.bestScore || 0}
                  color="text-green-600 dark:text-green-400"
                />
                <StatItem icon="📊" label="Total Score" value={stats.totalScore || 0} />
                <StatItem icon="🎯" label="Average" value={stats.averageScore || 0} />
                <StatItem icon="🎮" label="Games Played" value={stats.gamesPlayed || 0} />
                <StatItem
                  icon="🌟"
                  label="Games Won"
                  value={stats.gamesWon || 0}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatItem
                  icon="🏅"
                  label="Rank"
                  value={stats.rank ? `#${stats.rank}` : '-'}
                  color="text-purple-600 dark:text-purple-400"
                />
              </div>

              <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                <ComicText size={0.4}>Last played: {formatLastPlayed()}</ComicText>
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mb-2 text-4xl">🎮</div>
              <ComicText size={0.6}>No stats available yet</ComicText>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <ComicText size={0.4}>Play some games to see your stats!</ComicText>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserStatsCard;
