import React, { useState, useEffect } from "react";
import { colors } from "../lib/styles";
import { NavigationProps } from "../App";

export interface LeaderboardPageProps extends NavigationProps {}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      // Replace this with an actual API call if needed.
      const mockLeaderboard = [
        { username: "GIFmaster42", gamesWon: 32, bestScore: 95, averageScore: 78.5, bestGuessCount: 1 },
        { username: "EnigmaExpert", gamesWon: 28, bestScore: 90, averageScore: 71.2, bestGuessCount: 2 },
        { username: "PuzzleSolver", gamesWon: 25, bestScore: 85, averageScore: 73.7, bestGuessCount: 1 },
        { username: "WordHunter", gamesWon: 22, bestScore: 88, averageScore: 69.1, bestGuessCount: 3 },
        { username: "MysteryMaster", gamesWon: 18, bestScore: 82, averageScore: 65.4, bestGuessCount: 2 },
      ];
      setLeaderboard(mockLeaderboard);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div
      style={{
        width: "100%",
        padding: "16px",
        backgroundColor: colors.background,
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px",
        }}
      >
        <div
          onClick={() => onNavigate('landing')}
          style={{ display: "flex", flexDirection: "row", alignItems: "center", cursor: "pointer" }}
        >
          <span style={{ fontSize: "16px" }}>←</span>
          <span style={{ fontSize: "16px", marginLeft: "4px" }}>Back</span>
        </div>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", color: colors.primary, margin: 0 }}>
          Leaderboard
        </h2>
        <div style={{ flex: 1 }} />
      </div>

      {/* Leaderboard Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
        {/* Trophy Icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px" }}>
          <span style={{ fontSize: "32px" }}>🏆</span>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", color: colors.primary, margin: 0 }}>Top Players</h2>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div style={{ padding: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <span style={{ fontSize: "16px" }}>Loading Leaderboard Data...</span>
          </div>
        ) : (
          <>
            {/* Leaderboard Header */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                backgroundColor: colors.cardBackground,
                borderRadius: "8px",
                padding: "16px",
                alignItems: "center",
                border: `1px solid ${colors.border}`,
              }}
            >
              <span style={{ fontSize: "16px", fontWeight: "bold", width: "25%" }}>Rank</span>
              <span style={{ fontSize: "16px", fontWeight: "bold", width: "30%" }}>Player</span>
              <span style={{ fontSize: "16px", fontWeight: "bold", width: "25%" }}>Wins</span>
              <span style={{ fontSize: "16px", fontWeight: "bold", width: "20%" }}>Best Score</span>
            </div>

            {/* Leaderboard Entries */}
            {leaderboard.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {leaderboard.map((entry, index) => (
                  <div
                    key={index.toString()}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      backgroundColor: index === 0 ? colors.primary + "22" : colors.background,
                      borderRadius: "8px",
                      padding: "16px",
                      alignItems: "center",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ width: "25%", display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: "16px", fontWeight: index < 3 ? "bold" : "normal" }}>
                        {index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : ""}
                        {index + 1}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "16px",
                        width: "30%",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.username}
                    </span>
                    <span style={{ fontSize: "16px", width: "25%" }}>{entry.gamesWon}</span>
                    <span style={{ fontSize: "16px", width: "20%", color: colors.success }}>
                      {entry.bestScore}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.cardBackground,
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "16px", color: colors.textSecondary }}>
                  No leaderboard data available yet
                </span>
              </div>
            )}
          </>
        )}

        {/* Player Stats Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            padding: "16px",
            backgroundColor: colors.cardBackground,
            borderRadius: "8px",
            border: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: "16px", fontWeight: "bold", color: colors.primary }}>Your Stats</span>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>Games Won:</span>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>12</span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>Best Score:</span>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: colors.success }}>85</span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>Average Score:</span>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>67.5</span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>Global Rank:</span>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>#8</span>
          </div>
        </div>

        {/* Refresh Button */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "8px" }}>
          <button
            onClick={() => {
              setIsLoading(true);
              fetchLeaderboard();
            }}
            style={{
              padding: "12px 24px",
              backgroundColor: colors.secondary || "gray",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Refresh Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
