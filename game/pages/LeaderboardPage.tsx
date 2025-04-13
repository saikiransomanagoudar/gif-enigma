import React, { useState, useEffect, useRef } from "react";
import { NavigationProps } from "../lib/types";
import { ComicText } from "../lib/fonts";
import * as transitions from '../../src/utils/transitions';

export interface LeaderboardPageProps extends NavigationProps {
  postMessage?: (message: any) => void;
  username?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<{ totalScore: number; rank: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  const fetchLeaderboard = () => {
    window.parent.postMessage({ type: 'GET_TOP_SCORES' }, '*');
  };

  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener("change", handleThemeChange);
    return () => darkModeQuery.removeEventListener("change", handleThemeChange);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');

    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;

      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      }

      if (msg?.type === 'GET_TOP_SCORES_RESULT') {
        if (msg.success && Array.isArray(msg.scores)) {
          const top5 = msg.scores
            .sort((a: { bestScore: number }, b: { bestScore: number }) => b.bestScore - a.bestScore)
            .slice(0, 5);

          setLeaderboard(top5);
        }
        setIsLoading(false);
      }

      if (msg?.type === 'GET_CURRENT_USER_RESULT' && msg.success && msg.user?.username) {
        const username = msg.user.username;
        window.parent.postMessage({ type: 'GET_USER_STATS', data: { username } }, '*');
      }

      if (msg?.type === 'GET_USER_STATS_RESULT' && msg.success && msg.stats) {
        setUserStats({
          totalScore: msg.stats.score,
          rank: msg.rank,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (headerRef.current) transitions.fadeIn(headerRef.current, { duration: 400, direction: 'up', distance: 'sm' });
      if (titleRef.current) transitions.animateElement(titleRef.current, { duration: 500, delay: 200, direction: 'up' });
      if (subtitleRef.current) transitions.animateElement(subtitleRef.current, { duration: 500, delay: 300, direction: 'up' });
      if (backButtonRef.current) transitions.animateElement(backButtonRef.current, { duration: 400, delay: 100, direction: 'left' });
    }, 0);
  }, []);

  const handleBackClick = () => {
    if (headerRef.current) transitions.fadeOut(headerRef.current, { duration: 300 });
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach((card, index) => transitions.fadeOut(card as HTMLElement, { duration: 300, delay: index * 50 }));
    setTimeout(() => onNavigate('landing'), 450);
  };

  return (
    <div className={`flex w-full flex-col gap-6 p-6 md:p-10 rounded-lg ${isDarkMode ? "bg-gray-900 text-white" : "bg-[#E8E5DA] text-black"}`}>
      <button
        ref={backButtonRef}
        onClick={handleBackClick}
        className={`sm:w-[12%] max-sm:w-[22%] lg:w-[7%] ${isDarkMode ? 'bg-[#FF4500] text-white' :`bg-[#FF4500] text-black`} left-4 flex transform cursor-pointer items-center rounded-full border-none px-3 py-1.5 opacity-0 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg`}
      >
        <span className="mr-1 text-sm text-white">👈</span>
        <ComicText size={0.5} color="white">Back</ComicText>
      </button>

      <div className="flex flex-col items-center py-4 mt-[-66px]">
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
        <div className="rounded-lg shadow-md overflow-hidden">
          <div className="grid grid-cols-3 text-center font-bold dark:bg-gray-800 py-4 mt-[-12px]">
            <span><ComicText>Rank</ComicText></span>
            <span><ComicText>Player</ComicText></span>
            <span><ComicText>Total Score</ComicText></span>
          </div>

          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <div key={index} className="grid grid-cols-3 text-center py-3 border-b dark:border-gray-700">
                <span className="font-semibold">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index === 3 ? "🏅" : index === 4 ? "🎖️" : ""}
                </span>
                <ComicText><span className="truncate max-sm:text-sm max-sm:ml-[-15px]">{entry.username}</span></ComicText>
                <ComicText><span className="font-bold text-green-600 max-sm:ml-[15px]">{entry.bestScore}</span></ComicText>
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
        {userStats ? (
          <>
            <div className="flex justify-between text-xs">
              <span><ComicText>Your Total Score:</ComicText></span>
              <span className="font-bold text-green-600"><ComicText>{userStats.totalScore}</ComicText></span>
            </div>
            <div className="flex justify-between text-xs">
              <span><ComicText>Global Rank:</ComicText></span>
              <span className="font-bold"><ComicText>#{userStats.rank}</ComicText></span>
            </div>
          </>
        ) : (
          <ComicText>Loading your stats...</ComicText>
        )}
      </div>

      <ComicText>
        <div className="flex justify-center p-2">
          <button
            onClick={() => {
              setIsLoading(true);
              fetchLeaderboard();
            }}
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