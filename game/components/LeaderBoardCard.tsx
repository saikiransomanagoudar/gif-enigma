import React, { useState, useEffect } from 'react';
import { ComicText } from '../lib/fonts';

interface LeaderboardCardProps {
  title?: string;
  leaderboardData: any[];
  isLoading?: boolean;
  maxEntries?: number;
  username?: string;
  onViewMore?: () => void;
  scoreLabel?: string;
  type?: 'global' | 'cumulative';
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  title = 'Top Players',
  leaderboardData = [],
  isLoading = false,
  maxEntries = 5,
  username,
  onViewMore,
  scoreLabel = 'Score',
  type = 'global',
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

  // Get appropriate rank emoji
  const getRankEmoji = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  // Get the score value from an entry based on type
  const getScoreValue = (entry: any) => {
    if (type === 'global') {
      return entry.score;
    } else {
      return entry.totalScore || entry.score;
    }
  };

  return (
    <div className={`w-full rounded-lg shadow-md overflow-hidden ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 bg-[#FF4500] text-white flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-xl mr-2">🏆</span>
          <ComicText size={0.7}>{title}</ComicText>
        </div>
        {onViewMore && (
          <button 
            onClick={onViewMore}
            className="text-xs bg-white text-[#FF4500] px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ComicText size={0.4}>View All</ComicText>
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="grid grid-cols-3 border-b text-center py-2 text-sm font-semibold bg-gray-50 dark:bg-gray-700">
            <div>
              <ComicText size={0.5}>Rank</ComicText>
            </div>
            <div>
              <ComicText size={0.5}>Player</ComicText>
            </div>
            <div>
              <ComicText size={0.5}>{scoreLabel}</ComicText>
            </div>
          </div>

          {/* Table Content */}
          <div>
            {leaderboardData.length > 0 ? (
              leaderboardData.slice(0, maxEntries).map((entry, index) => (
                <div 
                  key={index}
                  className={`grid grid-cols-3 text-center py-2 border-b text-sm ${
                    username && entry.username === username 
                      ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                      : index % 2 === 0 
                        ? 'bg-white dark:bg-gray-800' 
                        : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-center items-center">
                    {getRankEmoji(index)}
                    <span className={`${getRankEmoji(index) ? 'hidden' : 'inline'} text-gray-500`}>
                      {index + 1}
                    </span>
                  </div>
                  <div className="truncate px-1">
                    {entry.username}
                    {username && entry.username === username && (
                      <span className="text-xs text-[#FF4500] ml-1">(You)</span>
                    )}
                  </div>
                  <div className="font-bold text-green-600 dark:text-green-400">
                    {getScoreValue(entry)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                <ComicText size={0.5}>No data available</ComicText>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LeaderboardCard;