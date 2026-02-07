import React, { useState, useEffect, useRef } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { Page } from '../lib/types';
import { getGame, hasUserCompletedGame, getCurrentUser, getRandomGame } from '../lib/api';
// @ts-ignore
import { requestExpandedMode } from '@devvit/web/client';

interface GamePagePreviewProps {
  gameId: string;
  onNavigate: (page: Page, params?: { gameId?: string }) => void;
}

interface GameData {
  id: string;
  word: string;
  gifs: string[];
  category: string;
  maskedWord: string;
  redditPostId?: string;
}

export const GamePagePreview: React.FC<GamePagePreviewProps> = ({ gameId, onNavigate }) => {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPlayingAgain, setIsPlayingAgain] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const isMounted = useRef(true);
  const isHandlingRequest = useRef(false);

  // Detect dark mode
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => {
      darkModeQuery.removeEventListener('change', handleThemeChange);
      isMounted.current = false;
    };
  }, []);

  // Load game data and check completion status
  useEffect(() => {
    async function loadGameData() {
      setIsLoading(true);
      
      try {
        // Get current user
        const userResult = await getCurrentUser();
        const currentUsername = userResult.success && userResult.username 
          ? userResult.username 
          : 'anonymous';
        setUsername(currentUsername);

        // Get game data
        const gameResult = await getGame(gameId);
        
        if (gameResult.success && gameResult.result) {
          setGameData(gameResult.result);

          // Check if user has completed this game
          if (currentUsername !== 'anonymous') {
            const completionResult = await hasUserCompletedGame(currentUsername, gameId);
            setHasCompleted(completionResult.completed || false);
          }
        }
      } catch (error) {
        console.error('Error loading game preview:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadGameData();
  }, [gameId]);

  // Handle "Decode the GIF" button - navigate to game page in expanded mode
  const handleDecodeClick = async (event: React.MouseEvent) => {
    try {
      await requestExpandedMode(event.nativeEvent, 'game');
    } catch (error) {
      console.error('Failed to enter expanded mode:', error);
      onNavigate('game', { gameId });
    }
  };

  // Handle "How to play?" button - navigate to how to play page in expanded mode
  const handleHowToPlayClick = async (event: React.MouseEvent) => {
    try {
      await requestExpandedMode(event.nativeEvent, 'howToPlay');
    } catch (error) {
      console.error('Failed to enter expanded mode:', error);
      onNavigate('howToPlay');
    }
  };

  // Handle "View Results" button - navigate to game results page in expanded mode
  const handleViewResultsClick = async (event: React.MouseEvent) => {
    try {
      await requestExpandedMode(event.nativeEvent, 'gameResults');
    } catch (error) {
      console.error('Failed to enter expanded mode:', error);
      onNavigate('gameResults', { gameId });
    }
  };

  // Handle "Play Again" button - similar to LandingPage's Let's Play logic
  const handlePlayAgainClick = async () => {
    // Prevent multiple simultaneous requests
    if (isHandlingRequest.current) {
      return;
    }

    isHandlingRequest.current = true;
    setIsPlayingAgain(true);
    setShowSuccessMessage(false);

    try {
      // Call API to get random unplayed game
      const response = await getRandomGame(
        username || 'anonymous',
        undefined // category is optional
      );

      if (!isMounted.current) {
        return;
      }

      if (response.success && response.result && response.result.game) {
        const game = response.result.game;
        const redditPostId = game.redditPostId;

        if (
          redditPostId &&
          game.gifs &&
          Array.isArray(game.gifs) &&
          game.gifs.length > 0 &&
          game.word
        ) {
          setShowSuccessMessage(true);

          setTimeout(() => {
            setIsPlayingAgain(false);
            setShowSuccessMessage(false);
            isHandlingRequest.current = false;
            // Navigate to the Reddit post using window.location
            window.location.href = `https://reddit.com/comments/${redditPostId}`;
          }, 150);
        } else {
          setIsPlayingAgain(false);
          setShowSuccessMessage(false);
          isHandlingRequest.current = false;
        }
      } else {
        setIsPlayingAgain(false);
        setShowSuccessMessage(false);
        isHandlingRequest.current = false;

        // Show contextual error messages
        const result = response.result || {};
        let errorMessage = '';

        if (result.hasPlayedAll) {
          errorMessage =
            "🎉 Amazing! You've completed all games! Check back later for new challenges.";
        } else if (result.error && result.error.includes('No games available yet')) {
          errorMessage = '🎨 No games yet! Be the first to create one!';
        } else if (result.error) {
          errorMessage = result.error;
        } else if (response.error) {
          errorMessage = response.error;
        } else {
          errorMessage = '😕 No games available right now. Try creating one!';
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to get random game:', error);
      setIsPlayingAgain(false);
      setShowSuccessMessage(false);
      isHandlingRequest.current = false;
    }
  };

  const backgroundColor = isDarkMode ? 'bg-[#1A1A2E]' : 'bg-[#E8E5DA]';
  const cardBackground = isDarkMode ? 'bg-[#0a1020]' : 'bg-[#f5f5f0]';
  const borderColor = isDarkMode ? 'border-[#1a2030]' : 'border-gray-300';

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex h-screen items-center justify-center ${backgroundColor}`}>
        <div className="text-center">
          <img 
            src="/eyebrows.gif" 
            alt="Loading game..."
            className="h-32 w-32 object-contain"
          />
        </div>
      </div>
    );
  }

  // Play Again loading overlay
  if (isPlayingAgain) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
        {!showSuccessMessage ? (
          <>
            <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
            <div className="mt-4">
              <ComicText size={0.8} color="white">
                Finding a new game for you...
              </ComicText>
            </div>
          </>
        ) : (
          <div className="animate-bounce text-center">
            <div className="mb-4 text-6xl">🎊</div>
            <ComicText size={1.2} color="#4ade80">
              Found a new game!
            </ComicText>
            <div className="mt-2">
              <ComicText size={0.7} color="white">
                Loading game...
              </ComicText>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (!gameData) {
    return (
      <div className={`flex h-screen items-center justify-center ${backgroundColor}`}>
        <div className="text-center">
          <ComicText size={1.2} color={colors.primary}>
            Oops!
          </ComicText>
          <div className="mt-2">
            <ComicText size={0.7} color={colors.textSecondary}>
              Game not found
            </ComicText>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col items-center p-5 ${backgroundColor}`}>
      {/* Header */}
      <div className="mt-6 mb-8 text-center">
        <ComicText size={1.8} color={colors.primary}>
          GIF Enigma
        </ComicText>
        <div className="mt-2">
          <ComicText size={0.6} color={colors.textSecondary}>
            {gameData.category}
          </ComicText>
        </div>
      </div>

      {/* GIF Preview - TV Screen Style */}
      <div className="mb-8 w-full max-w-md">
        <div
          className={`rounded-lg border-4 p-4 ${cardBackground} ${borderColor}`}
        >
          {gameData.gifs && gameData.gifs[0] && (
            <img
              src={gameData.gifs[0]}
              alt="GIF clue"
              className="h-64 w-full rounded object-cover"
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex w-full max-w-md flex-col gap-4">
        {!hasCompleted ? (
          // User hasn't completed the game
          <>
            <button
              onClick={handleDecodeClick}
              className="flex items-center justify-center gap-2 rounded-full bg-[#FF4500] px-6 py-4 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl">🔍</span>
              <ComicText size={0.8} color="white">
                Decode the GIF
              </ComicText>
            </button>

            <button
              onClick={handleHowToPlayClick}
              className="flex items-center justify-center gap-2 rounded-full bg-[#4267B2] px-6 py-4 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl">🤔</span>
              <ComicText size={0.8} color="white">
                How to play?
              </ComicText>
            </button>
          </>
        ) : (
          // User has completed the game
          <>
            <button
              onClick={handleViewResultsClick}
              className="flex items-center justify-center gap-2 rounded-full bg-[#FF4500] px-6 py-4 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl">📊</span>
              <ComicText size={0.8} color="white">
                View Results
              </ComicText>
            </button>

            <button
              onClick={handlePlayAgainClick}
              className="flex items-center justify-center gap-2 rounded-full bg-[#10B981] px-6 py-4 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl">🎮</span>
              <ComicText size={0.8} color="white">
                Play Again
              </ComicText>
            </button>
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-8 text-center">
        <ComicText size={0.5} color={colors.textSecondary}>
          {hasCompleted 
            ? '✅ You completed this game!' 
            : `Can you guess the ${gameData.category.toLowerCase()}?`
          }
        </ComicText>
      </div>
    </div>
  );
};

export default GamePagePreview;
