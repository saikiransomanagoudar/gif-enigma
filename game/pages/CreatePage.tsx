import React, { useState } from "react";
import { colors } from "../lib/styles";
import { Question } from "../lib/types";
import { ChewyText } from "../lib/fonts";
import { GifResult, redditSearchEnhanced } from "../server/redditSearch";
import { NavigationProps } from "../App";

// Define a local type for storing a question so that 'gifs' is a string array.
// type StoredQuestion = Omit<Question, "gifs"> & { gifs: string[] };

export interface CreatePageProps extends NavigationProps {}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate }) => {
  const [word, setWord] = useState<string>("");
  const [questionText, setQuestionText] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [showHint, setShowHint] = useState<boolean>(false);

  // Instead of using Devvit forms, we use prompt dialogs for simplicity.
  const handleSetWord = () => {
    const input = prompt("Enter the secret word:");
    if (input && input.trim() !== "") {
      setWord(input.trim());
    }
  };

  const handleSetQuestionText = () => {
    const input = prompt("Enter the question text:");
    if (input && input.trim() !== "") {
      setQuestionText(input.trim());
    }
  };

  const handleSetSearchTerm = () => {
    const input = prompt("Enter search term for GIFs:");
    if (input && input.trim() !== "") {
      setSearchTerm(input.trim());
      searchGifs(input.trim());
    }
  };

  // Search for GIFs using Reddit API (removed the context parameter)
  const searchGifs = async (term: string) => {
    if (!term) return;
    setIsLoading(true);
    setMessage("");
    try {
      const results = await redditSearchEnhanced({ query: searchTerm }, {} as any);
      setGifs(results);
      if (results.length === 0) {
        setMessage("No GIFs found. Try a different search term.");
        setMessageType("info");
      } else {
        setMessage(`Found ${results.length} GIFs from Reddit.`);
        setMessageType("success");
      }
    } catch (error) {
      console.error("Error searching GIFs:", error);
      setMessage("Failed to search GIFs. Please try again.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle GIF selection
  const toggleGifSelection = (gif: GifResult) => {
    if (selectedGifs.some((g) => g.id === gif.id)) {
      setSelectedGifs(selectedGifs.filter((g) => g.id !== gif.id));
    } else {
      if (selectedGifs.length < 4) {
        setSelectedGifs([...selectedGifs, gif]);
      } else {
        setMessage("You can only select 4 GIFs. Deselect one to add another.");
        setMessageType("info");
      }
    }
  };

  // Toggle hint visibility
  const toggleHint = () => {
    setShowHint(!showHint);
  };

  // Submit the created game
  const submitGame = async () => {
    if (!word) {
      setMessage("Please enter a word.");
      setMessageType("error");
      return;
    }
    if (!questionText) {
      setMessage("Please enter question text.");
      setMessageType("error");
      return;
    }
    if (selectedGifs.length !== 4) {
      setMessage("Please select exactly 4 GIFs.");
      setMessageType("error");
      return;
    }
    try {
      // Create a masked version of the word (mask about 2/3 of the letters)
      const wordArray = word.toUpperCase().split("");
      const maskCount = Math.floor((wordArray.length * 2) / 3);
      const indicesToMask = new Set<number>();
      while (indicesToMask.size < maskCount) {
        indicesToMask.add(Math.floor(Math.random() * wordArray.length));
      }
      const maskedWord = wordArray
        .map((char, index) => (indicesToMask.has(index) ? "_" : char))
        .join("");

      const gifUrls = selectedGifs.map((gif) => gif.url);

      const newQuestion: Question = {
        word: word.toUpperCase(),
        maskedWord,
        questionText,
        gifs: gifUrls,
        currentGifIndex: 0,
        hintsRevealed: false,
      };

      // Instead of saving to Redis, we simulate a save by logging the new game.
      console.log("New game created:", {
        ...newQuestion,
        createdAt: new Date().toISOString(),
      });

      setMessage("Game created successfully!");
      setMessageType("success");

      // Reset form state.
      setWord("");
      setQuestionText("");
      setSelectedGifs([]);
      setGifs([]);
      setSearchTerm("");
    } catch (error) {
      console.error("Error creating game:", error);
      setMessage("Failed to create game. Please try again.");
      setMessageType("error");
    }
  };

  // Render GIF grid with 2x2 layout.
  const renderGifGrid = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <p style={{ fontWeight: "bold", fontSize: "16px" }}>
        GIF Preview (click "Show Hint" to reveal)
      </p>
      <button onClick={toggleHint} style={{ marginBottom: "10px" }}>
        {showHint ? "Hide Hint" : "Show Hint"}
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {selectedGifs.slice(0, 4).map((gif, index) => (
          <div
            key={index}
            style={{
              width: "calc(50% - 5px)",
              height: "120px",
              backgroundColor: colors.cardBackground,
              borderRadius: "8px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                backgroundColor: showHint ? "transparent" : "rgba(0,0,0,0.8)",
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: colors.textSecondary }}>
                {showHint ? gif.content_description : `GIF ${index + 1}`}
              </span>
            </div>
          </div>
        ))}
        {selectedGifs.length < 4 &&
          Array.from({ length: 4 - selectedGifs.length }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              style={{
                width: "calc(50% - 5px)",
                height: "120px",
                backgroundColor: colors.cardBackground + "55",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: colors.textSecondary }}>
                Select a GIF
              </span>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        padding: "20px",
        backgroundColor: colors.background,
        borderRadius: "8px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => onNavigate('landing')} style={{ marginRight: "10px" }}>
          ← Back
        </button>
        <ChewyText size={1} color={colors.primary}>
          Create GIF Enigma
        </ChewyText>
      </div>

      {/* Creator Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Secret Word Input */}
        <div>
          <p style={{ fontWeight: "bold", fontSize: "16px" }}>Enter the secret word:</p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{word || "[Not set]"}</span>
            <button onClick={handleSetWord}>
              {word ? "Change Word" : "Set Word"}
            </button>
          </div>
          <p style={{ fontSize: "12px", color: colors.textSecondary }}>
            This is the word players will try to guess.
          </p>
        </div>

        {/* Question Text Input */}
        <div>
          <p style={{ fontWeight: "bold", fontSize: "16px" }}>Enter question text:</p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{questionText || "[Not set]"}</span>
            <button onClick={handleSetQuestionText}>
              {questionText ? "Change Text" : "Set Text"}
            </button>
          </div>
          <p style={{ fontSize: "12px", color: colors.textSecondary }}>
            This text will appear with the GIFs as an additional clue.
          </p>
        </div>

        {/* GIF Preview */}
        {selectedGifs.length > 0 && renderGifGrid()}

        {/* GIF Search */}
        <div
          style={{
            backgroundColor: colors.cardBackground,
            padding: "16px",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontWeight: "bold", fontSize: "16px" }}>
            Search for GIFs on Reddit:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{searchTerm || "[Enter search]"}</span>
            <button onClick={handleSetSearchTerm} disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
          <p style={{ fontSize: "12px", color: colors.textSecondary }}>
            Search for GIFs that hint at your secret word.
          </p>
        </div>

        {/* Selected GIFs */}
        <div
          style={{
            backgroundColor: colors.cardBackground,
            padding: "16px",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontWeight: "bold", fontSize: "16px" }}>
            Selected GIFs ({selectedGifs.length}/4):
          </p>
          {selectedGifs.length === 0 ? (
            <p style={{ fontSize: "12px", color: colors.textSecondary }}>
              No GIFs selected yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selectedGifs.map((gif, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px",
                    backgroundColor: colors.background,
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    GIF #{index + 1}: {gif.content_description}
                  </span>
                  <button onClick={() => toggleGifSelection(gif)} style={{ marginLeft: "auto" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GIF Search Results */}
        {gifs.length > 0 && (
          <div
            style={{
              backgroundColor: colors.cardBackground,
              padding: "16px",
              borderRadius: "8px",
            }}
          >
            <p style={{ fontWeight: "bold", fontSize: "16px" }}>Reddit GIF Results:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {gifs.map((gif, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px",
                    backgroundColor: colors.background,
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ width: "70%" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {gif.content_description}
                    </span>
                  </div>
                  <button onClick={() => toggleGifSelection(gif)} style={{ marginLeft: "auto" }}>
                    {selectedGifs.some((g) => g.id === gif.id) ? "Selected" : "Select"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div
            style={{
              padding: "16px",
              backgroundColor:
                messageType === "success"
                  ? colors.success + "33"
                  : messageType === "error"
                  ? colors.error + "33"
                  : colors.cardBackground,
              borderRadius: "8px",
            }}
          >
            <p
              style={{
                fontSize: "16px",
                color:
                  messageType === "success"
                    ? colors.success
                    : messageType === "error"
                    ? colors.error
                    : colors.textPrimary,
              }}
            >
              {message}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={submitGame}
          disabled={!word || !questionText || selectedGifs.length !== 4}
          style={{
            padding: "16px",
            backgroundColor: "blue",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Create GIF Enigma
        </button>
      </div>
    </div>
  );
};
