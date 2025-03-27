import React, { useState, useEffect, useRef } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { useLeaderboard } from '../lib/useLeaderboard';
import { NavigationProps } from '../lib/types';

export interface LeaderboardPageProps extends NavigationProps {
  postMessage?: (message: any) => void;
  username?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  onNavigate,
  postMessage,
  username,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'cumulative'>('global');
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // Use our custom hook for leaderboard data
  const { globalLeaderboard, cumulativeLeaderboard, userStats, isLoading, refresh } =
    useLeaderboard({
      postMessage: postMessage || (() => {}),
      username,
      limit: 50,
    });

  // Animation variants for items
  // const itemVariants = {
  //   hidden: { opacity: 0, y: 20 },
  //   visible: (i: number) => ({
  //     opacity: 1,
  //     y: 0,
  //     transition: {
  //       delay: i * 0.05,
  //       duration: 0.3,
  //     },
  //   }),
  // };

  // Check for dark mode
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const handleBackClick = () => {
    onNavigate('landing');
  };

  const handleRefresh = () => {
    refresh();
  };

  // Render trophy emoji based on rank
  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    if (index < 10) return '🏅';
    return '🎖️';
  };

  // Get the current leaderboard based on active tab
  const currentLeaderboard = activeTab === 'global' ? globalLeaderboard : cumulativeLeaderboard;

  // Format time in seconds to minutes and seconds
  const formatTime = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div
      className={`flex w-full flex-col gap-6 rounded-lg p-6 md:p-10 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-[#E8E5DA] text-black'
      }`}
    >
      {/* Back Button */}
      <div className="mb-4 flex items-center justify-start md:w-2/3">
        <button
          ref={backButtonRef}
          onClick={handleBackClick}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-4 py-2 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-2 text-sm text-white">👈</span>
          <ComicText size={0.6} color="white">
            Back to Home
          </ComicText>
        </button>
      </div>

      {/* Leaderboard Header */}
      <div className="flex flex-col items-center py-4">
        <span className="mb-2 text-5xl">🏆</span>
        <h2 className="text-3xl font-bold text-[#FF4500]">
          <ComicText>GIF Enigma Champions</ComicText>
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          <ComicText size={0.6}>Challenge the top players and climb the ranks!</ComicText>
        </p>
      </div>

      {/* Tab Selector */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`cursor-pointer rounded-l-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'global'
                ? 'bg-[#FF4500] text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            } transition-colors duration-200 hover:bg-[#E8E5DA] hover:text-white`}
          >
            <ComicText>High Scores</ComicText>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cumulative')}
            className={`cursor-pointer rounded-r-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'cumulative'
                ? 'bg-[#FF4500] text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            } transition-colors duration-200 hover:bg-[#FF4500] hover:text-white`}
          >
            <ComicText>Total Score</ComicText>
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF4500]"></div>
          <ComicText size={0.7} className="mt-4">
            Loading Leaderboard Data...
          </ComicText>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-gray-100 py-4 text-center font-bold dark:bg-gray-700">
            <span>
              <ComicText>Rank</ComicText>
            </span>
            <span>
              <ComicText>Player</ComicText>
            </span>
            <span>
              <ComicText>{activeTab === 'global' ? 'Best Score' : 'Total Score'}</ComicText>
            </span>
            <span>
              <ComicText>{activeTab === 'global' ? 'Time' : 'Games'}</ComicText>
            </span>
          </div>

          {/* Leaderboard Entries */}
          <div className="max-h-[400px] overflow-y-auto">
            {currentLeaderboard.length > 0 ? (
              currentLeaderboard.map((entry, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-4 items-center border-b py-3 text-center ${
                    username && entry.username === username
                      ? 'bg-yellow-50 dark:bg-yellow-900/20'
                      : index % 2 === 0
                        ? 'bg-gray-50 dark:bg-gray-800'
                        : 'bg-white dark:bg-gray-700'
                  } transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-600`}
                >
                  <span className="flex items-center justify-center text-xl font-semibold">
                    {getRankIcon(index)}
                    <span className="ml-2 text-sm text-gray-500">{index + 1}</span>
                  </span>
                  <span className="truncate font-medium">
                    {entry.username}
                    {username && entry.username === username && (
                      <span className="ml-2 text-xs text-[#FF4500]">(You)</span>
                    )}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {activeTab === 'global' ? entry.score : entry.totalScore || entry.score}
                  </span>
                  <span className="text-gray-500 dark:text-gray-300">
                    {activeTab === 'global'
                      ? formatTime(entry.timeTaken)
                      : entry.gamesPlayed || '-'}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                <ComicText>No leaderboard data available yet</ComicText>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Your Stats Section */}
      {username && userStats && (
        <div className="flex flex-col gap-4 rounded-lg border-t-4 border-[#FF4500] bg-white p-6 shadow-md dark:bg-gray-800">
          <div className="mb-2 flex items-center">
            <span className="mr-2 text-xl">👤</span>
            <span className="text-xl font-bold text-[#FF4500]">
              <ComicText>Your Stats</ComicText>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <ComicText size={0.5}>Best Score</ComicText>
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                <ComicText>{userStats.bestScore || userStats.score || '0'}</ComicText>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <ComicText size={0.5}>Games Played</ComicText>
              </div>
              <div className="text-lg font-bold">
                <ComicText>{userStats.gamesPlayed || '0'}</ComicText>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <ComicText size={0.5}>Average Score</ComicText>
              </div>
              <div className="text-lg font-bold">
                <ComicText>{userStats.averageScore || '0'}</ComicText>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <ComicText size={0.5}>Global Rank</ComicText>
              </div>
              <div className="text-lg font-bold">
                <ComicText>{userStats.rank ? `#${userStats.rank}` : '-'}</ComicText>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleRefresh}
          className="flex items-center rounded-lg bg-[#FF4500] px-6 py-3 text-white shadow-md transition hover:scale-105"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <ComicText>Refreshing...</ComicText>
            </>
          ) : (
            <>
              <span className="mr-2">🔄</span>
              <ComicText>Refresh Leaderboard</ComicText>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LeaderboardPage;
