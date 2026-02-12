import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { Page } from '../lib/types';
import {
  getGame,
  hasUserCompletedGame,
  getCurrentUser,
  getRandomGame,
  getGameState,
} from '../lib/api';
// @ts-ignore
import { requestExpandedMode } from '@devvit/web/client';
// @ts-ignore
import { navigateTo } from '@devvit/web/client';
interface GamePagePreviewProps {
  gameId: string | null;
  onNavigate: (page: Page, params?: { gameId?: string }, event?: React.MouseEvent) => void;
}

interface GameData {
  id: string;
  word: string;
  gifs: string[];
  category: string;
  maskedWord: string;
  redditPostId?: string;
  username?: string;
}

export const GamePagePreview: React.FC<GamePagePreviewProps> = ({ gameId, onNavigate }) => {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPlayingAgain, setIsPlayingAgain] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [gameState, setGameState] = useState<any>(null);

  const isMounted = useRef(true);
  const isHandlingRequest = useRef(false);

  const normalizePostId = (id: string) => (id.startsWith('t3_') ? id.slice(3) : id);
  const toAbsolutePostUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `https://www.reddit.com${url.startsWith('/') ? url : `/${url}`}`;
  };
  const buildPostUrl = (game: any) => {
    if (game?.postUrl) return toAbsolutePostUrl(game.postUrl);
    if (game?.redditPostId) {
      const cleanId = normalizePostId(game.redditPostId);
      return `https://www.reddit.com/comments/${cleanId}`;
    }
    return null;
  };

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

  const loadGameData = useCallback(async () => {
    if (!gameId) {
      setGameData(null);
      return;
    }

    setIsLoading(true);

    try {
      const userResult = await getCurrentUser();
      const currentUsername =
        userResult.success && userResult.username ? userResult.username : 'anonymous';
      setUsername(currentUsername);

      const gameResult = await getGame(gameId);

      const loadedGame = gameResult.game || gameResult.result;
      if (gameResult.success && loadedGame) {
        setGameData(loadedGame);

        if (currentUsername !== 'anonymous') {
          const completionResult = await hasUserCompletedGame(currentUsername, gameId);
          const completionFlag = Boolean(
            completionResult.hasCompleted ??
              completionResult.completed ??
              completionResult.hasCompleted?.completed
          );
          setHasCompleted(completionFlag);

          try {
            const stateResult = await getGameState(currentUsername, gameId);
            if (stateResult.success && stateResult.state?.playerState) {
              setGameState(stateResult.state.playerState);
            }
          } catch (error) {
            // error
          }
        }
      }
    } catch (error) {
      // error
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsLoading(false);
        setShowSuccessMessage(false);
      }
    };

    const handleFocus = () => {
      setIsLoading(false);
      setShowSuccessMessage(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleDecodeClick = (event: React.MouseEvent) => {
    requestExpandedMode(event.nativeEvent, 'game').catch(() => {
      onNavigate('game', { gameId: gameId ?? undefined });
    });
  };

  const handleHowToPlayClick = (event: React.MouseEvent) => {
    requestExpandedMode(event.nativeEvent, 'howToPlay').catch(() => {
      onNavigate('howToPlay');
    });
  };

  const handleViewResultsClick = (event: React.MouseEvent) => {
    requestExpandedMode(event.nativeEvent, 'gameResults').catch(() => {
      onNavigate('gameResults', { gameId: gameId ?? undefined });
    });
  };

  const handlePlayAgainClick = async (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (isHandlingRequest.current) {
      return;
    }

    isHandlingRequest.current = true;
    setIsPlayingAgain(true);
    setShowSuccessMessage(false);

    try {
      const response = await getRandomGame(username || 'anonymous', { useStickyNavigation: true });

      if (!isMounted.current) {
        return;
      }

      const resolvedGame = response.game || response.result?.game;
      if (response.success && resolvedGame) {
        const game = resolvedGame;
        const postUrl = buildPostUrl(game);

        if (postUrl && game.gifs && Array.isArray(game.gifs) && game.gifs.length > 0 && game.word) {
          setShowSuccessMessage(true);

          setTimeout(() => {
            setIsPlayingAgain(false);
            setShowSuccessMessage(false);
            isHandlingRequest.current = false;
            navigateTo(postUrl);
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

        const result = response.result || {};
        let errorMessage = '';

        if (result.hasPlayedAll) {
          errorMessage = '🎉 Amazing! you have played all games, more games to come, or feel free to create one!';
          setToastMessage(errorMessage);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
          return;
        }

        alert(errorMessage);
      }
    } catch (error) {
      setIsPlayingAgain(false);
      setShowSuccessMessage(false);
      isHandlingRequest.current = false;
    }
  };

  const backgroundColor = isDarkMode ? 'bg-[#1A1A2E]' : 'bg-[#E8E5DA]';
  const cardBackground = isDarkMode ? 'bg-[#0a1020]' : 'bg-[#f5f5f0]';
  const borderColor = isDarkMode ? 'border-[#1a2030]' : 'border-gray-300';

  if (!gameId) {
    return <div className={`min-h-screen w-full ${backgroundColor}`} />;
  }

  if (isLoading) {
    return <div className={`min-h-screen w-full ${backgroundColor}`} />;
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

  if (!gameData) {
    return <div className={`min-h-screen w-full ${backgroundColor}`} />;
  }

  return (
    <div className={`flex min-h-screen w-full flex-col items-center px-2 py-2 ${backgroundColor}`}>
      {/* Toast Notification */}
      {showToast && (
        <div
          className="fixed top-4 left-1/2 z-[10000] -translate-x-1/2 transform animate-[slideDown_0.3s_ease-out]"
          style={{
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FF6B35] px-6 py-4 shadow-2xl backdrop-blur-sm">
            <span className="text-2xl">🎉</span>
            <ComicText size={0.75} color="white">
              {toastMessage}
            </ComicText>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className="mt-5 mb-2 text-center">
        <ComicText size={2.0} color={colors.primary}>
          GIF Enigma
        </ComicText>
        <div className="mt-0.5">
          <ComicText size={1.0} color={colors.textSecondary}>
            {gameData.category}
          </ComicText>
        </div>
      </div>

      {/* Compact GIF Preview */}
      <div className="mt-2 mb-4 w-full max-w-[270px]">
        <div className={`aspect-square rounded-xl border p-2 ${cardBackground} ${borderColor}`}>
          {gameData.gifs && gameData.gifs[0] && (
            <img
              src={gameData.gifs[0]}
              alt="GIF clue"
              width="300"
              height="300"
              decoding="async"
              loading="eager"
              fetchPriority="high"
              className="h-full w-full rounded-lg object-cover"
            />
          )}
        </div>
      </div>

      {/* Compact Action Buttons */}
      <div className="flex w-full max-w-md flex-col items-center gap-2 sm:flex-row sm:items-stretch">
        {!hasCompleted ? (
          // User hasn't completed the game
          <>
            <button
              type="button"
              onClick={handleDecodeClick}
              className="flex w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FF4500] px-4 py-2.5 transition-all hover:scale-105 active:scale-95 sm:max-w-none"
            >
              <span className="text-lg">🔍</span>
              <ComicText size={0.6} color="white">
                Decode the GIF
              </ComicText>
            </button>

            <button
              type="button"
              onClick={handleHowToPlayClick}
              className="flex w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#4267B2] px-4 py-2.5 transition-all hover:scale-105 active:scale-95 sm:max-w-none"
            >
              <span className="text-lg">🤔</span>
              <ComicText size={0.6} color="white">
                How to play?
              </ComicText>
            </button>
          </>
        ) : (
          // User has completed the game
          <>
            <button
              type="button"
              onClick={handleViewResultsClick}
              className="flex w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FF4500] px-4 py-2.5 transition-all hover:scale-105 active:scale-95 sm:max-w-none"
            >
              <span className="text-lg">📊</span>
              <ComicText size={0.6} color="white">
                View Results
              </ComicText>
            </button>

            <button
              type="button"
              onClick={handlePlayAgainClick}
              className="flex w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#10B981] px-4 py-2.5 transition-all hover:scale-105 active:scale-95 sm:max-w-none"
            >
              <span className="text-lg">🎮</span>
              <ComicText size={0.6} color="white">
                {gameState?.hasGivenUp
                  ? 'Try another'
                  : gameData?.username && username === gameData.username
                    ? 'Play a new game'
                    : 'Play again'}
              </ComicText>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GamePagePreview;
