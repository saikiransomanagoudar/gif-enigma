import React, { useState, useEffect, useRef } from "react";
import { NavigationProps } from "../lib/types";
import { ComicText } from "../lib/fonts";
import * as transitions from '../../src/utils/transitions';

export interface LeaderboardPageProps extends NavigationProps {
  postMessage?: (message: any) => void;
  username?: string;
  gameId?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate, gameId }) => {
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
          const top10 = msg.scores
            .sort((a: { bestScore: number }, b: { bestScore: number }) => b.bestScore - a.bestScore)
            .slice(0, 10);

          setLeaderboard(top10);
        }
        setIsLoading(false);
      }

      if (msg?.type === 'GET_CURRENT_USER_RESULT' && msg.success && msg.user?.username) {
        const username = msg.user.username;
        window.parent.postMessage({ type: 'GET_USER_STATS', data: { username } }, '*');
      }

      if (msg?.type === 'GET_USER_STATS_RESULT' && msg.success) {
        if (msg.stats && typeof msg.stats.score === 'number' && msg.rank) {
          setUserStats({
            totalScore: msg.stats.score,
            rank: msg.rank,
          });
        } else {
          // fallback
          setUserStats({
            totalScore: 0,
            rank: 0,
          });
        }
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
    
    // If gameId exists, go back to game results page; otherwise go to landing page
    setTimeout(() => {
      if (gameId) {
        onNavigate('gameResults', { gameId });
      } else {
        onNavigate('landing');
      }
    }, 450);
  };

  return (
    <div className={`flex w-full flex-col gap-6 p-6 md:p-10 pb-24 rounded-lg ${isDarkMode ? "bg-gray-900 text-white" : "bg-[#E8E5DA] text-black"}`}>
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
          <div className="grid font-bold dark:bg-gray-800 py-4 mt-[-12px] gap-4 sm:gap-6 md:gap-8 lg:gap-10" style={{ gridTemplateColumns: '50px 1fr auto' }}>
            <div className="flex justify-start pl-2"><ComicText>Rank</ComicText></div>
            <div className="flex justify-start"><ComicText>Player</ComicText></div>
            <div className="flex justify-end pr-2"><ComicText>Total Score</ComicText></div>
          </div>

          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <div key={index} className="grid py-3 border-b dark:border-gray-700 items-center gap-4 sm:gap-6 md:gap-8 lg:gap-10" style={{ gridTemplateColumns: '50px 1fr auto' }}>
                <div className="flex justify-start items-center pl-2">
                  {index === 0 ? (
                    <span className="text-2xl leading-none inline-block w-5 text-center">🥇</span>
                  ) : index === 1 ? (
                    <span className="text-2xl leading-none inline-block w-5 text-center">🥈</span>
                  ) : index === 2 ? (
                    <span className="text-2xl leading-none inline-block w-5 text-center">🥉</span>
                  ) : (
                    <ComicText><span className="font-semibold inline-block w-5 text-center pl-2">{index + 1}</span></ComicText>
                  )}
                </div>
                <div className="flex justify-start">
                  <ComicText><span className={`max-sm:text-sm ${index < 3 ? 'text-lg font-semibold' : 'text-base'}`}>{entry.username}</span></ComicText>
                </div>
                <div className="flex justify-end pr-2">
                  <ComicText><span className="font-bold text-green-600">{entry.bestScore.toLocaleString()}</span></ComicText>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              <ComicText>No leaderboard data available yet</ComicText>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar for User Stats */}
      <div className={`fixed bottom-0 left-0 right-0 ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"} border-t-2 shadow-lg z-50`}>
        <div className="flex items-center justify-between px-3 py-3 max-w-full gap-2">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-base sm:text-lg">📊</span>
            <ComicText size={0.70}>
              <span className={`${isDarkMode ? "text-gray-300" : "text-gray-700"} whitespace-nowrap`}>Your Stats</span>
            </ComicText>
          </div>
          {userStats ? (
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink overflow-x-auto scrollbar-hide">
              <ComicText size={0.70}>
                <span className="font-bold text-[#FF4500] whitespace-nowrap">#{userStats.rank.toLocaleString()}</span>
              </ComicText>
              <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} flex-shrink-0`}>|</span>
              <ComicText size={0.70}>
                <span className="font-bold text-green-600 whitespace-nowrap">{userStats.totalScore.toLocaleString()}</span>
              </ComicText>
            </div>
          ) : (
            <ComicText size={0.70}>
              <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>Loading...</span>
            </ComicText>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;