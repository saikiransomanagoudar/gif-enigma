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

  // dark mode
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // get appropriate rank emoji
  const getRankEmoji = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  // get the score value from an entry based on type
  const getScoreValue = (entry: any) => {
    if (type === 'global') {
      return entry.score;
    } else {
      return entry.totalScore || entry.score;
    }
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-lg shadow-md ${
        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      }`}
    >
      <div className="flex items-center justify-between bg-[#FF4500] px-4 py-3 text-white">
        <div className="flex items-center">
          <span className="mr-2 text-xl">🏆</span>
          <ComicText size={0.7}>{title}</ComicText>
        </div>
        {onViewMore && (
          <button
            onClick={onViewMore}
            className="rounded bg-white px-2 py-1 text-xs text-[#FF4500] transition-colors hover:bg-gray-100"
          >
            <ComicText size={0.4}>View All</ComicText>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF4500]"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 border-b bg-gray-50 py-2 text-center text-sm font-semibold dark:bg-gray-700">
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

          <div>
            {leaderboardData.length > 0 ? (
              leaderboardData.slice(0, maxEntries).map((entry, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-3 border-b py-2 text-center text-sm ${
                    username && entry.username === username
                      ? 'bg-yellow-50 dark:bg-yellow-900/20'
                      : index % 2 === 0
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {getRankEmoji(index)}
                    <span className={`${getRankEmoji(index) ? 'hidden' : 'inline'} text-gray-500`}>
                      {index + 1}
                    </span>
                  </div>
                  <div className="truncate px-1">
                    {entry.username}
                    {username && entry.username === username && (
                      <span className="ml-1 text-xs text-[#FF4500]">(You)</span>
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
