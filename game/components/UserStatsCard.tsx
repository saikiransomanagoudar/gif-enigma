import React, { useState, useEffect } from 'react';
import { ComicText } from '../lib/fonts';

interface StatItemProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color = 'text-gray-800 dark:text-white' }) => (
  <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
    <div className="text-xl mb-1">{icon}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
      <ComicText size={0.4}>{label}</ComicText>
    </div>
    <div className={`font-bold text-lg ${color}`}>
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

  // Check for dark mode
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Format last played date if available
  const formatLastPlayed = () => {
    if (!stats.lastPlayed) return 'Never';
    const date = new Date(stats.lastPlayed);
    return date.toLocaleDateString();
  };

  return (
    <div className={`w-full rounded-lg shadow-md overflow-hidden ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 bg-[#FF4500] text-white">
        <div className="flex items-center">
          <span className="text-xl mr-2">👤</span>
          <div>
            <ComicText size={0.7}>{username}'s Stats</ComicText>
            <div className="text-xs opacity-80">
              <ComicText size={0.4}>Your GIF Enigma performance</ComicText>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <div className="p-4">
          {stats && Object.keys(stats).length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <StatItem 
                  icon="🏆" 
                  label="Best Score" 
                  value={stats.bestScore || 0} 
                  color="text-green-600 dark:text-green-400"
                />
                <StatItem 
                  icon="📊" 
                  label="Total Score" 
                  value={stats.totalScore || 0}
                />
                <StatItem 
                  icon="🎯" 
                  label="Average" 
                  value={stats.averageScore || 0}
                />
                <StatItem 
                  icon="🎮" 
                  label="Games Played" 
                  value={stats.gamesPlayed || 0}
                />
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
                <ComicText size={0.4}>
                  Last played: {formatLastPlayed()}
                </ComicText>
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="text-4xl mb-2">🎮</div>
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