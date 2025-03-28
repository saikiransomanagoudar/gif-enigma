import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps } from '../lib/types';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';

export interface LeaderboardPageProps extends NavigationProps {
  username?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Listen for the leaderboard response from the parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let payload = event.data;

      // If it’s the Devvit wrapper, unwrap once:
      if (payload.type === 'devvit-message' && payload.data) {
        payload = payload.data;
      }

      // Now check the unwrapped payload type:
      if (payload.type === 'GET_CUMULATIVE_LEADERBOARD_RESULT') {
        const { success, result, error } = payload;
        if (success) {
          setLeaderboard(result.leaderboard);
        } else {
          console.error('Error fetching leaderboard:', error);
        }
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Function to request the leaderboard using window.parent.postMessage
  const fetchLeaderboard = () => {
    setIsLoading(true);
    // Send a message with type 'GET_CUMULATIVE_LEADERBOARD' and include a limit (adjust if needed)
    window.parent.postMessage({ type: 'GET_CUMULATIVE_LEADERBOARD', data: { limit: 10 } }, '*');
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleBackClick = () => {
    onNavigate('landing');
  };

  return (
    <div
      className={`flex w-full flex-col gap-6 rounded-lg p-6 md:p-10 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-[#E8E5DA] text-black'
      }`}
    >
      <div className="mb-4 flex items-center justify-start md:w-2/3">
        <button
          onClick={handleBackClick}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
      </div>

      <div className="mt-[-66px] flex flex-col items-center py-4">
        <span className="text-4xl">🏆</span>
        <h2 className="text-2xl font-bold text-[#FF4500]">
          <ComicText>Top Players</ComicText>
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <ComicText>Loading Leaderboard Data...</ComicText>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg shadow-md">
          <div className="mt-[-12px] grid grid-cols-3 py-4 text-center font-bold dark:bg-gray-800">
            <span>
              <ComicText>Rank</ComicText>
            </span>
            <span>
              <ComicText>Player</ComicText>
            </span>
            <span>
              <ComicText>Best Score</ComicText>
            </span>
          </div>
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <div
                key={index}
                className="grid grid-cols-3 border-b py-3 text-center dark:border-gray-700"
              >
                <span className="font-semibold">
                  {index === 0
                    ? '🥇'
                    : index === 1
                      ? '🥈'
                      : index === 2
                        ? '🥉'
                        : index === 3
                          ? '🏅'
                          : index === 4
                            ? '🎖️'
                            : ''}
                </span>
                <span className="truncate">{entry.username}</span>
                <span className="font-bold text-green-600">{entry.bestScore}</span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              <ComicText>No leaderboard data available yet</ComicText>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg p-4 shadow-md dark:bg-gray-800">
        <span className="text-lg font-bold text-[#FF4500]">
          <ComicText>Your Stats</ComicText>
        </span>
        <div className="flex justify-between text-xs">
          <span>
            <ComicText>Best Score:</ComicText>
          </span>
          <span className="font-bold text-green-600">
            <ComicText>85</ComicText>
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span>
            <ComicText>Average Score:</ComicText>
          </span>
          <span className="font-bold">
            <ComicText>67.5</ComicText>
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span>
            <ComicText>Global Rank:</ComicText>
          </span>
          <span className="font-bold">
            <ComicText>#8</ComicText>
          </span>
        </div>
      </div>

      <ComicText>
        <div className="flex justify-center p-2">
          <button
            onClick={fetchLeaderboard}
            className="cursor-pointer rounded-lg bg-[#FF4500] px-6 py-3 text-white shadow-md transition hover:scale-105"
          >
            Refresh Leaderboard
          </button>
        </div>
      </ComicText>
    </div>
  );
};

export default LeaderboardPage;
