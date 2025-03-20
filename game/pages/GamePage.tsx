import React, { useState, CSSProperties } from "react";
import { NavigationProps } from "../App";
import { colors } from "../lib/styles";      // <-- from styles.ts
import { ChewyText } from "../lib/fonts";    // <-- from fonts.tsx

export const GamePage: React.FC<NavigationProps> = ({ onNavigate }) => {
  // Example GIF URLs
  const gifUrls = [
    "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    "https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif",
    "https://media.giphy.com/media/l0MYB8Ory7Hqefo9a/giphy.gif",
    "https://media.giphy.com/media/26uf9QPzzlKPvQG3i/giphy.gif",
  ];

  // How many GIFs are revealed (1..4)
  const [gifHintCount, setGifHintCount] = useState(1);

  // Example hidden answer (ALL CAPS)
  const answer = "HELLO WORLD";
  const [revealedLetters, setRevealedLetters] = useState<Set<string>>(new Set());

  // User's guess (uppercase)
  const [guess, setGuess] = useState("");

  // Common pill button style, using your color palette
  const pillButtonStyle: CSSProperties = {
    backgroundColor: colors.primary,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "9999px",
    padding: "10px 20px",
    fontFamily: "'Chewy', cursive",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  // Reveal next GIF
  const handleGifHint = () => {
    if (gifHintCount < 4) {
      setGifHintCount(gifHintCount + 1);
    }
  };

  // Reveal two random letters
  const handleWordHint = () => {
    const unrevealed = answer
      .split("")
      .filter((ch) => ch !== " " && !revealedLetters.has(ch));

    if (unrevealed.length === 0) return; // Already revealed everything

    let toReveal = Math.min(2, unrevealed.length);
    const newSet = new Set(revealedLetters);

    while (toReveal > 0 && unrevealed.length > 0) {
      const idx = Math.floor(Math.random() * unrevealed.length);
      newSet.add(unrevealed[idx]);
      unrevealed.splice(idx, 1);
      toReveal--;
    }
    setRevealedLetters(newSet);
  };

  // Check guess
  const handleGuess = () => {
    const normalizedGuess = guess.replace(/\s+/g, "");
    const normalizedAnswer = answer.replace(/\s+/g, "");
    if (normalizedGuess === normalizedAnswer) {
      alert("Correct! You guessed the word!");
    } else {
      alert("Incorrect guess. Try again!");
    }
  };

  // Render the GIF window with dynamic layout, using objectFit: "contain"
  const renderGifGrid = () => {
    if (gifHintCount === 1) {
      // One GIF
      return (
        <div style={{ width: "600px", borderRadius: "8px", overflow: "hidden" }}>
          <img
            src={gifUrls[0]}
            alt="GIF 1"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      );
    } else if (gifHintCount === 2) {
      // Two GIFs side by side
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            width: "600px",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {gifUrls.slice(0, 2).map((url, i) => (
            <div key={i} style={{ width: "100%", overflow: "hidden" }}>
              <img
                src={url}
                alt={`GIF ${i + 1}`}
                style={{
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      );
    } else if (gifHintCount === 3) {
      // Three GIFs: two on top, one bottom center
      return (
        <div style={{ width: "600px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {gifUrls.slice(0, 2).map((url, i) => (
              <div key={i} style={{ flex: 1, overflow: "hidden", borderRadius: "8px" }}>
                <img
                  src={url}
                  alt={`GIF ${i + 1}`}
                  style={{
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "50%", overflow: "hidden", borderRadius: "8px" }}>
              <img
                src={gifUrls[2]}
                alt="GIF 3"
                style={{
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      );
    } else {
      // Four GIFs in a 2×2 grid
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: "8px",
            width: "600px",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {gifUrls.slice(0, 4).map((url, i) => (
            <div key={i} style={{ width: "100%", overflow: "hidden" }}>
              <img
                src={url}
                alt={`GIF ${i + 1}`}
                style={{
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      );
    }
  };

  // Render answer boxes
  const renderAnswerBoxes = () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
      {answer.split("").map((ch, idx) => {
        if (ch === " ") {
          return <div key={`space-${idx}`} style={{ width: "16px" }} />;
        }
        const isRevealed = revealedLetters.has(ch);
        return (
          <div
            key={idx}
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: colors.cardBackground,
              borderRadius: "8px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span style={{ color: colors.primary, fontFamily: "'Chewy', cursive", fontSize: "16px" }}>
              {isRevealed ? ch : "_"}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        backgroundColor: colors.background, // from styles.ts
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Back Button */}
        <button
          onClick={() => onNavigate("landing")}
          style={{ ...pillButtonStyle, fontSize: "16px" }}
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Heading using ChewyText */}
        <ChewyText size={2} color={colors.primary} align="center">
          Gif Enigma
        </ChewyText>

        {/* Spacer for alignment */}
        <div style={{ width: "80px" }} />
      </div>

      {/* GIF Window */}
      <div style={{ marginTop: "20px" }}>{renderGifGrid()}</div>

      {/* Hint Buttons */}
      <div style={{ marginTop: "20px", display: "flex", gap: "16px" }}>
        <button onClick={handleGifHint} style={pillButtonStyle}>
          GIF Hint
        </button>
        <button onClick={handleWordHint} style={pillButtonStyle}>
          Word Hint
        </button>
      </div>

      {/* Answer Boxes */}
      <div style={{ marginTop: "20px" }}>{renderAnswerBoxes()}</div>

      {/* Guess Input & Button */}
      <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="TYPE YOUR GUESS"
          value={guess}
          onChange={(e) => setGuess(e.target.value.toUpperCase())}
          style={{
            fontFamily: "'Chewy', cursive",
            fontSize: "16px",
            textTransform: "uppercase",
            backgroundColor: colors.cardBackground,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            padding: "12px",
            width: "300px",
            textAlign: "center",
          }}
        />
        <button onClick={handleGuess} style={pillButtonStyle}>
          GUESS
        </button>
      </div>
    </div>
  );
};

export default GamePage;
