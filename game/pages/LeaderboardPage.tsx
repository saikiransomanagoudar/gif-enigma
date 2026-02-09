import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps } from '../lib/types';
import { ComicText } from '../lib/fonts';
import * as transitions from '../../src/utils/transitions';
// @ts-ignore
import { requestExpandedMode, exitExpandedMode } from '@devvit/web/client';

// Refactored: Import API functions
import { getCurrentUser, getTopScores, getUserStats } from '../lib/api';

const CACHE_TTL = 60000;
const LEADERBOARD_CACHE_KEY = 'gif_enigma_leaderboard_cache';
const USER_DATA_CACHE_KEY = 'gif_enigma_user_data_cache';

function getCachedLeaderboard() {
  try {
    const cached = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedLeaderboard(data: any[]) {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function getCachedUserData() {
  try {
    const cached = localStorage.getItem(USER_DATA_CACHE_KEY);
    if (!cached) return null;
    const { username, stats, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return { username, stats };
  } catch {
    return null;
  }
}

function setCachedUserData(username: string, stats: { totalScore: number; rank: number }) {
  try {
    localStorage.setItem(
      USER_DATA_CACHE_KEY,
      JSON.stringify({ username, stats, timestamp: Date.now() })
    );
  } catch {}
}

export interface LeaderboardPageProps extends NavigationProps {
  postMessage?: (message: any) => void;
  username?: string;
  gameId?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate, gameId }) => {
  const cachedLeaderboard = getCachedLeaderboard();
  const cachedUserData = getCachedUserData();
  const hasCachedData = cachedLeaderboard !== null;

  const [leaderboard, setLeaderboard] = useState<any[]>(cachedLeaderboard || []);
  const [userStats, setUserStats] = useState<{ totalScore: number; rank: number } | null>(
    cachedUserData?.stats || null
  );
  const [isLoading, setIsLoading] = useState(!hasCachedData);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(
    cachedUserData?.username || null
  );
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const userRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user first to get username for parallel stats fetch
        const userResult = await getCurrentUser();
        const username = userResult.success ? userResult.user?.username : null;
        
        if (username) {
          setCurrentUsername(username);
        }

        // Fetch leaderboard and user stats in parallel
        const [leaderboardResult, statsResult] = await Promise.allSettled([
          getTopScores(),
          username ? getUserStats(username) : Promise.resolve({ success: false }),
        ]);

        if (
          leaderboardResult.status === 'fulfilled' &&
          leaderboardResult.value.success &&
          Array.isArray(leaderboardResult.value.leaderboard)
        ) {
          const top50 = leaderboardResult.value.leaderboard.slice(0, 50);
          setCachedLeaderboard(top50);
          setLeaderboard(top50);
        }

        // Process user stats
        if (statsResult.status === 'fulfilled' && statsResult.value.success) {
          const stats = {
            totalScore: statsResult.value.stats?.score ?? 0,
            rank: statsResult.value.rank ?? 0,
          };

          if (username) {
            setCachedUserData(username, stats);
          }
          setUserStats(stats);
        }

        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    }
    
    if (!hasCachedData) {
      fetchData();
    } else {
      setIsLoading(false);
      fetchData();
    }
  }, [hasCachedData]);

  useEffect(() => {
    if (headerRef.current)
      transitions.fadeIn(headerRef.current, { duration: 400, direction: 'up', distance: 'sm' });
    if (titleRef.current)
      transitions.animateElement(titleRef.current, { duration: 500, delay: 200, direction: 'up' });
    if (subtitleRef.current)
      transitions.animateElement(subtitleRef.current, {
        duration: 500,
        delay: 300,
        direction: 'up',
      });
    if (backButtonRef.current)
      transitions.animateElement(backButtonRef.current, {
        duration: 400,
        delay: 50,
        direction: 'left',
      });
  }, []);

  const handleBackClick = (event: React.MouseEvent) => {
    if (gameId) {
      requestExpandedMode(event.nativeEvent, 'gameResults')
        .then(() => {
          if (headerRef.current) transitions.fadeOut(headerRef.current, { duration: 300 });
          const categoryCards = document.querySelectorAll('.category-card');
          categoryCards.forEach((card, index) =>
            transitions.fadeOut(card as HTMLElement, { duration: 300, delay: index * 50 })
          );
        })
        .catch(() => {
          onNavigate('gameResults', { gameId });
        });
    } else {
      exitExpandedMode(event.nativeEvent)
        .then(() => {
          // Animations can happen after successful exit
          if (headerRef.current) transitions.fadeOut(headerRef.current, { duration: 300 });
          const categoryCards = document.querySelectorAll('.category-card');
          categoryCards.forEach((card, index) =>
            transitions.fadeOut(card as HTMLElement, { duration: 300, delay: index * 50 })
          );
        })
        .catch(() => {
          onNavigate('landing');
        });
    }
  };

  const handleScrollToUser = () => {
    if (userRowRef.current) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      userRowRef.current.classList.add('pulse-highlight');
      setTimeout(() => {
        userRowRef.current?.classList.remove('pulse-highlight');
      }, 2000);
    }
  };

  return (
    <div
      className={`relative flex h-screen w-full flex-col gap-3 pb-20 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-[#E8E5DA] text-black'}`}
    >
      <button
        type="button"
        ref={backButtonRef}
        onClick={handleBackClick}
        className={`absolute top-4 left-4 z-10 flex transform cursor-pointer items-center rounded-full border-none bg-[#FF4500] px-3 py-1.5 text-white opacity-0 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg md:left-6`}
      >
        <span className="mr-1 text-sm">👈</span>
        <ComicText size={0.5} color="white">
          Back
        </ComicText>
      </button>

      <div className="flex items-center justify-center gap-1 px-6 pt-4 pb-2 md:px-10">
        <span className="text-2xl">🏆</span>
        <h2 className="text-xl font-bold text-[#FF4500]">
          <ComicText>Top Players</ComicText>
        </h2>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <ComicText>Loading Leaderboard Data...</ComicText>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 md:px-10">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg shadow-md">
            <div
              className="grid flex-shrink-0 gap-4 py-4 font-bold sm:gap-6 md:gap-8 lg:gap-10 dark:bg-gray-800"
              style={{ gridTemplateColumns: '50px 1fr 120px' }}
            >
              <div className="flex justify-start pl-2">
                <ComicText>Rank</ComicText>
              </div>
              <div className="flex justify-center">
                <ComicText>Player</ComicText>
              </div>
              <div className="flex justify-end pr-2">
                <ComicText>Score</ComicText>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.username === currentUsername;
                  return (
                    <div
                      key={index}
                      ref={isCurrentUser ? userRowRef : null}
                      className={`grid items-center gap-4 border-b py-3 transition-all duration-300 sm:gap-6 md:gap-8 lg:gap-10 dark:border-gray-700 ${
                        isCurrentUser
                          ? isDarkMode
                            ? 'border-orange-500/50 bg-orange-900/30'
                            : 'border-orange-300 bg-orange-100'
                          : ''
                      }`}
                      style={{ gridTemplateColumns: '50px 1fr 120px' }}
                    >
                      <div className="flex items-center justify-start pl-2">
                        {index === 0 ? (
                          <span className="inline-block w-5 text-center text-2xl leading-none">
                            🥇
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-block w-5 text-center text-2xl leading-none">
                            🥈
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-block w-5 text-center text-2xl leading-none">
                            🥉
                          </span>
                        ) : (
                          <ComicText>
                            <span className="inline-block w-5 pl-2 text-center font-semibold">
                              {index + 1}
                            </span>
                          </ComicText>
                        )}
                      </div>
                      <div className="flex min-w-0 items-center justify-start gap-2">
                        {entry.snoovatarUrl ? (
                          <img
                            src={entry.snoovatarUrl}
                            alt={`${entry.username}'s avatar`}
                            className="h-8 w-8 flex-shrink-0 object-contain"
                          />
                        ) : (
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-xl">
                            👤
                          </span>
                        )}
                        <ComicText>
                          <span
                            className={`max-sm:text-xs ${index < 3 ? 'text-base font-semibold' : 'text-sm'} truncate`}
                          >
                            {entry.username}
                          </span>
                        </ComicText>
                      </div>
                      <div className="flex justify-end pr-2">
                        <ComicText>
                          <span
                            className={`font-bold text-green-600 ${index < 3 ? 'text-base' : 'text-sm'}`}
                          >
                            {entry.score.toLocaleString()}
                          </span>
                        </ComicText>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <ComicText>No leaderboard data available yet</ComicText>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar for User Stats */}
      <div
        className={`fixed right-0 bottom-0 left-0 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'} z-50 m-2 rounded-2xl border-2 shadow-lg ${
          userStats && userStats.rank > 0 && userStats.rank <= 50
            ? 'cursor-pointer transition-all duration-150 hover:opacity-90 hover:shadow-xl active:scale-[0.98] active:shadow-md'
            : ''
        }`}
        onClick={
          userStats && userStats.rank > 0 && userStats.rank <= 50 ? handleScrollToUser : undefined
        }
      >
        <div className="flex max-w-full items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="text-base sm:text-lg">📊</span>
            <ComicText size={0.7}>
              <span
                className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-nowrap`}
              >
                Your Stats
              </span>
            </ComicText>
            {userStats && userStats.rank > 0 && userStats.rank <= 50 && (
              <span className="text-sm opacity-60">👆</span>
            )}
          </div>
          {userStats ? (
            <div className="scrollbar-hide flex flex-shrink items-center gap-2 overflow-x-auto sm:gap-4">
              <ComicText size={0.7}>
                <span className="font-bold whitespace-nowrap text-[#FF4500]">
                  #{userStats.rank.toLocaleString()}
                </span>
              </ComicText>
              <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex-shrink-0`}>
                |
              </span>
              <ComicText size={0.7}>
                <span className="font-bold whitespace-nowrap text-green-600">
                  {userStats.totalScore.toLocaleString()}
                </span>
              </ComicText>
            </div>
          ) : (
            <ComicText size={0.7}>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Loading...</span>
            </ComicText>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
