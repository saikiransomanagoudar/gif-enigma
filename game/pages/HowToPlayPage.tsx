import React from "react";
import { colors } from "../lib/styles";
import { NavigationProps } from "../App";

export interface HowToPlayPageProps extends NavigationProps {}

export const HowToPlayPage: React.FC<HowToPlayPageProps> = ({ onNavigate }) => {
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
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "16px" }}>←</span>
          <span style={{ fontSize: "16px", marginLeft: "4px" }}>Back</span>
        </div>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: colors.primary,
            margin: 0,
          }}
        >
          How to Play
        </h2>
        <div style={{ flex: 1 }} />
      </div>

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: colors.primary,
            textAlign: "center",
            margin: 0,
          }}
        >
          GIF Enigma 🎬❓
        </h1>
        <p style={{ fontSize: "16px", textAlign: "center", margin: 0 }}>
          Can you guess the hidden word from a GIF?
        </p>

        <div
          style={{
            padding: "16px",
            backgroundColor: colors.cardBackground,
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Play Mode Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: colors.primary,
                margin: 0,
              }}
            >
              Play Mode
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🔍</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  You'll be presented with 3 questions to solve.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🎬</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Each question has 4 hidden GIFs as clues.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>👁️</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Initially only the first GIF is shown.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>💡</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  If you need help, reveal more GIFs as hints (-10 points each).
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>⌨️</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Type your guess in the input field and submit.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>⏱️</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Answer before the timer runs out!
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🏆</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Score points based on speed and minimal hint usage.
                </span>
              </div>
            </div>
          </div>

          {/* Create Mode Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: colors.primary,
                margin: 0,
              }}
            >
              Create Mode
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>✏️</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Enter a secret word for others to guess.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🔎</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Search for GIFs using Tenor API.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🖼️</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Select 4 GIFs that hint at your secret word.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>💾</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Submit your creation to the game library.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🎮</span>
                <span style={{ marginLeft: "8px", fontSize: "16px" }}>
                  Other players can now encounter your creation!
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Call-to-Action */}
        <div
          style={{
            padding: "16px",
            backgroundColor: colors.cardBackground,
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>
            Think fast, guess smart, and crack the GIF enigma!
          </h3>
          <button
            onClick={() => onNavigate('landing')}
            style={{
              padding: "12px 24px",
              backgroundColor: colors.primary,
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Get Started!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToPlayPage;
