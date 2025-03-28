import React, { useState, useEffect, useRef } from "react";
import { NavigationProps } from "../lib/types";
import { ComicText } from "../lib/fonts";

export interface LeaderboardPageProps extends NavigationProps {
  postMessage?: (message: any) => void;
  username?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener("change", handleThemeChange);
    return () => darkModeQuery.removeEventListener("change", handleThemeChange);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const mockLeaderboard = [
        { username: "GIFmaster42", bestScore: 95 },
        { username: "EnigmaExpert", bestScore: 90 },
        { username: "PuzzleSolver", bestScore: 85 },
        { username: "WordHunter", bestScore: 88 },
        { username: "MysteryMaster", bestScore: 82 },
      ];
      setLeaderboard(mockLeaderboard);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const handleBackClick = () => {
    onNavigate("landing");
  };
  

  return (
    <div
      className={`flex w-full flex-col gap-6 p-6 md:p-10 rounded-lg ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-[#E8E5DA] text-black"
      }`}
    >
      {/* Back Button */}
      {/* Back Button */}
      <div className="flex items-center justify-start mb-4 md:w-2/3">
        <button
          ref={backButtonRef}
          onClick={handleBackClick}
          className="flex items-center gap-2 rounded-full bg-[#FF4500] px-4 py-2 text-white transition-all  hover:scale-105"
        >
          👈 <ComicText size={0.5} className="text-white">Back</ComicText>
        </button>
      </div>


      {/* Leaderboard Header */}
      <div className="flex flex-col items-center py-4 mt-[-66px]">
        <span className="text-4xl">🏆</span>
        <h2 className="text-2xl font-bold text-[#FF4500]">
          <ComicText>Top Players</ComicText>
        </h2>
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <ComicText>Loading Leaderboard Data...</ComicText>
        </div>
      ) : (
        <div className="rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-3 text-center font-bold  dark:bg-gray-800 py-4 mt-[-12px]">
            <span><ComicText>Rank</ComicText></span>
            <span><ComicText>Player</ComicText></span>
            <span><ComicText>Best Score</ComicText></span>
          </div>

          {/* Leaderboard Entries */}
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <div
                key={index}
                className="grid grid-cols-3 text-center py-3 border-b dark:border-gray-700"
              >
                <span className="font-semibold">
                  {index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : index === 3
                    ? "🏅"
                    : index === 4
                    ? "🎖️"
                    : ""}
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

      {/* Your Stats Section */}
      <div className="flex flex-col gap-4 rounded-lg p-4 shadow-md dark:bg-gray-800">
        <span className="text-lg font-bold text-[#FF4500]"><ComicText>Your Stats</ComicText></span>
        <div className="flex justify-between text-xs">
          <span><ComicText>Best Score:</ComicText></span>
          <span className="font-bold text-green-600"><ComicText>85</ComicText></span>
        </div>
        <div className="flex justify-between text-xs">
          <span><ComicText>Average Score:</ComicText></span>
          <span className="font-bold"><ComicText>67.5</ComicText></span>
        </div>
        <div className="flex justify-between text-xs">
          <span><ComicText>Global Rank:</ComicText></span>
          <span className="font-bold"><ComicText>#8</ComicText></span>
        </div>
      </div>

      {/* Refresh Button */}
      <ComicText>
      <div className="flex justify-center p-2">
        <button
          onClick={() => {
            setIsLoading(true);
            fetchLeaderboard();
          }}
          className="rounded-lg bg-[#FF4500] px-6 py-3 text-white shadow-md transition hover:scale-105"
        >
          Refresh Leaderboard
        </button>
      </div>
      </ComicText>
    </div>
  );
};

export default LeaderboardPage;