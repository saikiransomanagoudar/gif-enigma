import React, { useState, useEffect, useRef } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { GameStatistics, NavigationProps, Page } from '../lib/types';
import { filterGuesses } from '../lib/profanityFilter';

interface GameResultsPageProps extends NavigationProps {
  onNavigate: (page: Page, params?: { gameId?: string }) => void;
  gameId?: string;
}

export const GameResultsPage: React.FC<GameResultsPageProps> = ({ onNavigate, gameId }) => {
  const [statistics, setStatistics] = useState<GameStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isCommentPosting, setIsCommentPosting] = useState(false);
  const [isCommentPosted, setIsCommentPosted] = useState(false);
  const [hasAlreadyCommented, setHasAlreadyCommented] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [isGameStateLoaded, setIsGameStateLoaded] = useState(false);
  const [acceptedSynonyms, setAcceptedSynonyms] = useState<string[]>([]);
  const [debugMode, setDebugMode] = useState(true); // Set to true by default for debugging

  // Play Again handling (reuse landing page logic)
  const [isFindingGame, setIsFindingGame] = useState(false);
  const [gameFound, setGameFound] = useState(false);
  const isHandlingPlayAgainRequest = useRef(false);


    const handlePlayAgainClick = () => {
    if (isHandlingPlayAgainRequest.current) {
      return;
    }

    isHandlingPlayAgainRequest.current = true;
    setIsFindingGame(true);
    setGameFound(false);

    let timeoutId: number | undefined;
    let isHandled = false;

    const handleGameResponse = (event: MessageEvent) => {
      let message: any = event.data;

      // Unwrap devvit messages like in LandingPage
      if (message && message.type === 'devvit-message' && message.data?.message) {
        message = message.data.message;
      } else if (message && message.type === 'devvit-message' && message.data) {
        message = message.data;
      }

      if (message?.type === 'GET_RANDOM_GAME_RESULT') {
        if (isHandled) return;
        isHandled = true;

        window.removeEventListener('message', handleGameResponse);
        if (timeoutId) window.clearTimeout(timeoutId);

        if (message.success && message.result && message.result.game) {
          const game = message.result.game;
          const redditPostId = game.redditPostId;

          if (
            redditPostId &&
            game.gifs &&
            Array.isArray(game.gifs) &&
            game.gifs.length > 0 &&
            game.word
          ) {
            // Show game found message briefly before navigating
            setGameFound(true);
            setIsFindingGame(false);
            
            setTimeout(() => {
              isHandlingPlayAgainRequest.current = false;
              // Same as LandingPage: jump to the post
              window.parent.postMessage(
                {
                  type: 'NAVIGATE_TO_POST',
                  data: { postId: redditPostId },
                },
                '*'
              );
            }, 800);
          } else {
            setIsFindingGame(false);
            isHandlingPlayAgainRequest.current = false;
            window.parent.postMessage(
              {
                type: 'SHOW_TOAST',
                data: {
                  text: '⚠️ Could not find a valid game to play. Please try again.',
                  appearance: 'error',
                },
              },
              '*'
            );
          }
        } else {
          const result = message.result || {};
          let errorMessage = '';

          if (result.hasPlayedAll) {
            errorMessage =
              "🎉 Amazing! You've completed all games! Check back later for new challenges.";
          } else if (result.error && result.error.includes('No games available yet')) {
            errorMessage =
              '🎨 No games yet! Be the first to create one by tapping "Let\'s Build"';
          } else if (result.error) {
            errorMessage = result.error;
          } else if (message.error) {
            errorMessage = message.error;
          } else {
            errorMessage = '😕 No games available right now. Try creating one!';
          }

          setIsFindingGame(false);
          isHandlingPlayAgainRequest.current = false;
          window.parent.postMessage(
            {
              type: 'SHOW_TOAST',
              data: {
                text: errorMessage,
                appearance: 'info',
              },
            },
            '*'
          );
        }
      }
    };

    // Ensure no duplicate listener
    window.removeEventListener('message', handleGameResponse);
    window.addEventListener('message', handleGameResponse);

    // Same GET_RANDOM_GAME call as LandingPage
    window.parent.postMessage(
      {
        type: 'GET_RANDOM_GAME',
        data: {
          username: username || 'anonymous',
          preferUserCreated: true,
          useStickyNavigation: true,
        },
      },
      '*'
    );

    timeoutId = window.setTimeout(() => {
      if (!isHandled) {
        window.removeEventListener('message', handleGameResponse);
        setIsFindingGame(false);
        isHandlingPlayAgainRequest.current = false;
        window.parent.postMessage(
          {
            type: 'SHOW_TOAST',
            data: {
              text: 'Request timed out. Please try again.',
              appearance: 'error',
            },
          },
          '*'
        );
      }
    }, 10000);
  };


  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';

  // Get current username
  useEffect(() => {
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');
  }, []);

  // Check if user has already commented on this game
  useEffect(() => {
    if (username && gameId && username !== 'anonymous') {
      window.parent.postMessage(
        {
          type: 'CHECK_USER_COMMENT',
          data: {
            username,
            gameId,
          },
        },
        '*'
      );
    }
  }, [username, gameId]);

  // Fetch game state when we have both username and gameId
  useEffect(() => {
    if (username && gameId) {
      if (username !== 'anonymous') {
        window.parent.postMessage(
          {
            type: 'GET_GAME_STATE',
            data: {
              username,
              gameId,
            },
          },
          '*'
        );
      } else {
        // Anonymous users don't have saved state - mark as loaded
        setIsGameStateLoaded(true);
        setGameState(null);
      }
    }
  }, [username, gameId]);

  // Fetch synonyms for the answer word when statistics are loaded
  // This is now retrieved from the game data (pre-computed at creation time)
  useEffect(() => {
    if (statistics?.acceptedSynonyms) {
      setAcceptedSynonyms(statistics.acceptedSynonyms);
    }
  }, [statistics]);

  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
      setIsLoading(false);
      return;
    }

    // Request statistics from the server
    window.parent.postMessage(
      {
        type: 'GET_GAME_STATISTICS',
        data: { gameId },
      },
      '*'
    );

    const handleMessage = (event: MessageEvent) => {
      let actualMessage = event.data;
      if (actualMessage && actualMessage.type === 'devvit-message' && actualMessage.data?.message) {
        actualMessage = actualMessage.data.message;
      }

      if (actualMessage.type === 'GET_GAME_STATISTICS_RESULT') {
        setIsLoading(false);
        if (actualMessage.success && actualMessage.statistics) {
          setStatistics(actualMessage.statistics);
        } else {
          setError(actualMessage.error || 'Failed to load statistics');
        }
      }

      if (actualMessage.type === 'GET_CURRENT_USER_RESULT') {
        if (actualMessage.success && actualMessage.user?.username) {
          setUsername(actualMessage.user.username);
        } else {
          setUsername('anonymous');
        }
      }

      if (actualMessage.type === 'GET_GAME_STATE_RESULT') {
        if (actualMessage.success && actualMessage.state?.playerState) {
          setGameState(actualMessage.state.playerState);
          setIsGameStateLoaded(true);
        } else {
          setGameState(null);
          setIsGameStateLoaded(true);
        }
      }

      if (actualMessage.type === 'POST_COMPLETION_COMMENT_RESULT') {
        if (debugMode) console.log('[GameResultsPage] Received POST_COMPLETION_COMMENT_RESULT:', actualMessage);
        setIsCommentPosting(false);
        if (actualMessage.success) {
          if (actualMessage.alreadyPosted) {
            if (debugMode) console.log('[GameResultsPage] User already commented');
            // User already commented before
            setHasAlreadyCommented(true);
            setIsCommentPosted(true);
          } else {
            if (debugMode) console.log('[GameResultsPage] Comment posted successfully');
            // New comment posted successfully
            setIsCommentPosted(true);
          }
        } else {
          if (debugMode) console.error('[GameResultsPage] Failed to post comment:', actualMessage.error);
          window.parent.postMessage(
            {
              type: 'SHOW_TOAST',
              data: {
                text: actualMessage.error || 'Failed to post comment',
                appearance: 'error',
              },
            },
            '*'
          );
        }
      }

      if (actualMessage.type === 'CHECK_USER_COMMENT_RESULT') {
        if (debugMode) console.log('[GameResultsPage] Received CHECK_USER_COMMENT_RESULT:', actualMessage);
        if (actualMessage.success && actualMessage.hasCommented) {
          if (debugMode) console.log('[GameResultsPage] User has already commented on this game');
          setHasAlreadyCommented(true);
          setIsCommentPosted(true);
        }
      }

      if (actualMessage.type === 'DEBUG_MODE_TOGGLED') {
        setDebugMode(actualMessage.enabled);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameId]);

  const handleBackClick = () => {
    onNavigate('landing');
  };

  // Helper function to check if a guess is correct (exact match or valid synonym)
  const isGuessCorrect = (guess: string, answer: string): boolean => {
    const normalizeString = (str: string) => 
      str.replace(/\s+/g, '').replace(/[^\w]/g, '').trim().toUpperCase();
    
    const normalizedGuess = normalizeString(guess);
    const normalizedAnswer = normalizeString(answer);
    
    // Check exact match first
    if (normalizedGuess === normalizedAnswer) {
      return true;
    }
    
    // Check if lengths match (requirement for synonym validation)
    if (normalizedGuess.length !== normalizedAnswer.length) {
      return false;
    }
    
    // Check if guess is in the acceptedSynonyms list (pre-computed at game creation)
    if (acceptedSynonyms && acceptedSynonyms.length > 0) {
      const normalizedSynonyms = acceptedSynonyms.map(syn => normalizeString(syn));
      
      // Check if the normalized guess matches any accepted synonym
      return normalizedSynonyms.some(syn => 
        syn === normalizedGuess && syn.length === normalizedAnswer.length
      );
    }
    
    return false;
  };

  // Helper function to format a guess to match the answer's word structure
  const formatGuessLikeAnswer = (guess: string, answer: string): string => {
    const normalizeString = (str: string) => 
      str.replace(/\s+/g, '').replace(/[^\w]/g, '').trim().toUpperCase();
    
    const normalizedGuess = normalizeString(guess);
    const normalizedAnswer = normalizeString(answer);
    
    // Only format if the normalized strings match
    if (normalizedGuess !== normalizedAnswer) {
      return guess; // Return original if not a match
    }
    
    // Split answer into words to get the spacing pattern
    const answerWords = answer.split(/\s+/);
    const result: string[] = [];
    let guessIndex = 0;
    
    // Reconstruct the guess with the same word breaks as the answer
    for (const word of answerWords) {
      const wordLength = word.replace(/[^\w]/g, '').length;
      const guessSegment = normalizedGuess.substring(guessIndex, guessIndex + wordLength);
      result.push(guessSegment);
      guessIndex += wordLength;
    }
    
    return result.join(' ');
  };

  const handlePostComment = () => {
    if (debugMode) console.log('[GameResultsPage] handlePostComment called - gameId:', gameId, 'username:', username);
    if (!gameId || !username) {
      if (debugMode) console.warn('[GameResultsPage] Cannot post comment - missing gameId or username');
      return;
    }
    if (isCommentPosting || isCommentPosted) {
      if (debugMode) console.log('[GameResultsPage] Comment already posting or posted');
      return;
    }
    const gifHintCount = gameState?.gifHintCount || 1;
    const gifHintsUsed = gifHintCount > 1 ? gifHintCount - 1 : 0;
    const actualGuesses = gameState?.numGuesses || 1;

    if (debugMode) console.log('[GameResultsPage] Sending POST_COMPLETION_COMMENT - guesses:', actualGuesses, 'gifHints:', gifHintsUsed);
    setIsCommentPosting(true);
    window.parent.postMessage(
      {
        type: 'POST_COMPLETION_COMMENT',
        data: {
          gameId: gameId,
          username: username,
          numGuesses: actualGuesses,
          gifHints: gifHintsUsed,
        },
      },
      '*'
    );
  };

  if (isLoading) {
    return (
      <div className={`${backgroundColor} flex min-h-screen items-center justify-center`}>
        <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
      </div>
    );
  }

  if (error || !statistics) {
    return (
      <div className={`${backgroundColor} flex min-h-screen flex-col items-center justify-center p-5`}>
        <div className="max-w-md text-center">
          <ComicText size={1.2} color={colors.primary}>
            Oops!
          </ComicText>
          <ComicText size={0.7} color={colors.textSecondary}>
            {error || 'Failed to load statistics'}
          </ComicText>
          <button
            onClick={handleBackClick}
            className="mt-6 cursor-pointer rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <ComicText size={0.6} color="white">
              Back to Home
            </ComicText>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${backgroundColor} flex min-h-screen flex-col p-5`}>
      {/* Header */}
      <header className="relative mb-3 flex w-full items-center justify-between">
        <button
          onClick={handleBackClick}
          className="flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.6} color="white">
            Home
          </ComicText>
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <div style={{ fontWeight: 'normal' }}>
            <ComicText size={1.2} color={colors.primary}>
              Game Results
            </ComicText>
          </div>
        </div>
        <div className="w-20"></div>
      </header>

      {/* Answer Highlight */}
      <div className="mb-5 text-center">
        <div style={{ fontFamily: "Comic Sans MS, Comic Sans, cursive", fontSize: "24px", color: "#EAB308", fontWeight: "bold", letterSpacing: "1px" }}>
          {statistics.answer.toUpperCase()}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-3xl">
        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3 text-center backdrop-blur-sm dark:bg-gray-800/20">
            <ComicText size={1.2} color="#2563EB">
              {statistics.totalPlayers}
            </ComicText>
            <ComicText size={0.55} color={colors.textSecondary}>
              Players
            </ComicText>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center backdrop-blur-sm dark:bg-gray-800/20">
            <ComicText size={1.2} color="#9333EA">
              {statistics.totalGuesses}
            </ComicText>
            <ComicText size={0.55} color={colors.textSecondary}>
              Total Attempts
            </ComicText>
          </div>
        </div>

        {/* Guesses Section */}
        <div className="rounded-xl bg-white/5 p-6 backdrop-blur-sm dark:bg-gray-800/20">
          <div className="mb-4">
            <ComicText size={0.9} color={colors.primary}>
              Decode attempts
            </ComicText>
          </div>

          {statistics.guesses.length === 0 ? (
            <div className="py-8 text-center">
              <ComicText size={0.7} color={colors.textSecondary}>
                No attempts yet.
              </ComicText>
            </div>
          ) : (
            <div className="space-y-4">
              {filterGuesses(statistics.guesses, 'mask')
                .filter((guessData) => {
                  // Filter out attempts that don't match the answer's normalized length
                  const normalizeLength = (str: string) => 
                    str.replace(/\s+/g, '').replace(/[^\w]/g, '').length;
                  return normalizeLength(guessData.guess) === normalizeLength(statistics.answer);
                })
                .sort((a, b) => {
                  // Check if each guess is exact match or close match
                  const aIsCorrect = isGuessCorrect(a.guess, statistics.answer);
                  const bIsCorrect = isGuessCorrect(b.guess, statistics.answer);
                  
                  const aIsExactMatch = a.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() === 
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();
                  const bIsExactMatch = b.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() === 
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();
                  
                  // Priority 1: Exact matches first
                  if (aIsExactMatch && !bIsExactMatch) return -1;
                  if (!aIsExactMatch && bIsExactMatch) return 1;
                  
                  // Priority 2: Close matches (correct but not exact) second
                  if (aIsCorrect && !aIsExactMatch && !bIsCorrect) return -1;
                  if (bIsCorrect && !bIsExactMatch && !aIsCorrect) return 1;
                  
                  // Priority 3: Within same category, sort by count descending
                  return b.count - a.count;
                })
                .slice(0, 10) // Show top 10 to accommodate multiple correct answers
                .map((guessData, index) => {
                  const isCorrect = isGuessCorrect(guessData.guess, statistics.answer);
                  const isExactMatch = guessData.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() === 
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();
                  
                  // Format correct guesses to match the answer's spacing
                  const displayGuess = isCorrect 
                    ? formatGuessLikeAnswer(guessData.guess, statistics.answer).toUpperCase()
                    : guessData.guess.toUpperCase();
                  
                  return (
                    <div key={index} className="space-y-1">
                      {/* Guess text with checkmark/star indicator */}
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 'bold' }}>
                          <ComicText size={0.7} color={isCorrect ? "#10B981" : "#CA8A04"}>
                            {displayGuess}
                          </ComicText>
                        </div>
                        {isCorrect && (
                          <div className="flex items-center gap-1">
                            <span className="text-lg">{isExactMatch ? '✅' : '✨'}</span>
                            {!isExactMatch && (
                              <div 
                                className="rounded-full px-2 py-0.5 border"
                                style={{ 
                                  backgroundColor: isDarkMode ? 'rgba(167, 139, 250, 0.2)' : 'rgba(124, 58, 237, 0.15)',
                                  borderColor: isDarkMode ? '#A78BFA' : '#7C3AED'
                                }}
                              >
                                <ComicText size={0.5} color={isDarkMode ? '#C4B5FD' : '#7C3AED'}>
                                  close match
                                </ComicText>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Progress Bar with count inside */}
                      <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCorrect 
                              ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600'
                          }`}
                          style={{ width: `${guessData.percentage}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ComicText size={0.65} color={isDarkMode ? '#E5E7EB' : '#374151'}>
                            {guessData.count} attempt{guessData.count !== 1 ? 's' : ''}
                          </ComicText>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div className="mt-6 flex flex-col items-center justify-center gap-4">
          {(() => {
            // Only show comment button if:
            // 1. Game state has loaded (isGameStateLoaded = true)
            // 2. User didn't give up (hasGivenUp !== true AND gifHintCount !== 999)
            // 3. User hasn't already commented (hasAlreadyCommented = false)
            // 4. User is not the game creator
            // Note: If gameState is null after loading, user hasn't played yet (show button)
            const hasGivenUp =
              gameState?.hasGivenUp === true || gameState?.gifHintCount === 999;
            const isCreator =
              statistics?.creatorUsername && username === statistics.creatorUsername;
            const shouldShow =
              isGameStateLoaded && !hasGivenUp && !hasAlreadyCommented && !isCreator;
            return shouldShow;
          })() && (
            <button
              onClick={handlePostComment}
              disabled={isCommentPosting || isCommentPosted || !username}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-300 disabled:cursor-not-allowed w-full sm:w-auto sm:min-w-[220px] ${
                isCommentPosted
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg hover:shadow-xl'
                  : isCommentPosting
                    ? 'bg-gradient-to-r from-indigo-400 to-purple-500 opacity-90 shadow-md'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-lg hover:scale-105 hover:shadow-xl'
              }`}
              style={{
                boxShadow: isCommentPosted
                  ? '0 8px 20px rgba(16,185,129,0.4)'
                  : isCommentPosting
                    ? '0 8px 20px rgba(99,102,241,0.3)'
                    : '0 4px 12px rgba(217,119,6,0.4)',
              }}
            >
              <span className="text-xl">
                {isCommentPosted ? '✅' : isCommentPosting ? '⏳' : '💬'}
              </span>
              <div
                style={{ fontFamily: 'Comic Sans MS, cursive, sans-serif', fontSize: '16px' }}
              >
                {isCommentPosted ? 'Commented!' : isCommentPosting ? 'Commenting…' : 'Comment Results'}
              </div>
            </button>
          )}

          {/* Leaderboard + Play Again in one row on desktop, stacked on mobile */}
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            {/* Leaderboard button */}
            <button
              onClick={() => onNavigate('leaderboard', { gameId: statistics.gameId })}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg w-full sm:w-auto sm:flex-1 sm:min-w-[220px]"
              style={{ backgroundColor: colors.primary }}
            >
              <span className="text-lg">🏆</span>
              <ComicText size={0.7} color="white">
                Leaderboard
              </ComicText>
            </button>

            {/* Play Again button – uses GET_RANDOM_GAME flow from landing */}
            <button
              onClick={handlePlayAgainClick}
              disabled={isFindingGame || gameFound}
              className="play-again-button flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-white w-full sm:w-auto sm:flex-1 sm:min-w-[220px]"
              style={{ 
                backgroundColor: colors.secondary, 
                opacity: isFindingGame || gameFound ? 0.8 : 1
              }}
            >
              <span className="text-xl">{gameFound ? '🎮' : isFindingGame ? '⏳' : '⛹️'}</span>
              <ComicText size={0.7} color="white">
                {gameFound 
                  ? 'Game found!' 
                  : isFindingGame 
                    ? 'Finding game...' 
                    : statistics?.creatorUsername && username === statistics.creatorUsername
                      ? 'Try another'
                      : 'Play again'}
              </ComicText>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameResultsPage;
