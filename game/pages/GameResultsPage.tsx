import React, { useState, useEffect } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { GameStatistics, NavigationProps, Page } from '../lib/types';

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
        setIsCommentPosting(false);
        if (actualMessage.success) {
          if (actualMessage.alreadyPosted) {
            // User already commented before
            setHasAlreadyCommented(true);
            setIsCommentPosted(true);
          } else {
            // New comment posted successfully
            setIsCommentPosted(true);
          }
        } else {
          window.alert(actualMessage.error || 'Failed to post comment');
        }
      }

      if (actualMessage.type === 'CHECK_USER_COMMENT_RESULT') {
        if (actualMessage.success && actualMessage.hasCommented) {
          setHasAlreadyCommented(true);
          setIsCommentPosted(true);
        }
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

  const handlePostComment = () => {
    if (!gameId || !username) return;
    if (isCommentPosting || isCommentPosted) return;
    const gifHintCount = gameState?.gifHintCount || 1;
    const gifHintsUsed = gifHintCount > 1 ? gifHintCount - 1 : 0;
    const actualGuesses = gameState?.numGuesses || 1;

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
              Total Guesses
            </ComicText>
          </div>
        </div>

        {/* Guesses Section */}
        <div className="rounded-xl bg-white/5 p-6 backdrop-blur-sm dark:bg-gray-800/20">
          <div className="mb-4">
            <ComicText size={0.9} color={colors.primary}>
              Guesses Made
            </ComicText>
          </div>

          {statistics.guesses.length === 0 ? (
            <div className="py-8 text-center">
              <ComicText size={0.7} color={colors.textSecondary}>
                No guesses yet. Be the first to play!
              </ComicText>
            </div>
          ) : (
            <div className="space-y-4">
              {statistics.guesses
                .sort((a, b) => {
                  // Check if each guess is correct (exact or synonym match)
                  const aIsCorrect = isGuessCorrect(a.guess, statistics.answer);
                  const bIsCorrect = isGuessCorrect(b.guess, statistics.answer);
                  
                  // Correct answers always come first
                  if (aIsCorrect && !bIsCorrect) return -1;
                  if (!aIsCorrect && bIsCorrect) return 1;
                  
                  // Otherwise sort by count descending
                  return b.count - a.count;
                })
                .slice(0, 10) // Show top 10 to accommodate multiple correct answers
                .map((guessData, index) => {
                  const isCorrect = isGuessCorrect(guessData.guess, statistics.answer);
                  const isExactMatch = guessData.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() === 
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();
                  
                  return (
                    <div key={index} className="space-y-1">
                      {/* Guess text with checkmark/star indicator */}
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 'bold' }}>
                          <ComicText size={0.7} color={isCorrect ? "#10B981" : "#CA8A04"}>
                            {guessData.guess.toUpperCase()}
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
                            {guessData.count} guess{guessData.count !== 1 ? 'es' : ''}
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
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          {(() => {
            // Only show comment button if:
            // 1. Game state has loaded (isGameStateLoaded = true)
            // 2. User didn't give up (hasGivenUp !== true AND gifHintCount !== 999)
            // 3. User hasn't already commented (hasAlreadyCommented = false)
            // 4. User is not the game creator
            // Note: If gameState is null after loading, user hasn't played yet (show button)
            const hasGivenUp = gameState?.hasGivenUp === true || gameState?.gifHintCount === 999;
            const isCreator = statistics?.creatorUsername && username === statistics.creatorUsername;
            const shouldShow = isGameStateLoaded && !hasGivenUp && !hasAlreadyCommented && !isCreator;
            return shouldShow;
          })() && (
            <button
              onClick={handlePostComment}
              disabled={isCommentPosting || isCommentPosted || !username}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white font-bold transition-all duration-300 disabled:cursor-not-allowed w-full sm:w-auto sm:min-w-[220px] ${
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
                    : '0 4px 12px rgba(217,119,6,0.4)'
              }}
            >
              <span className="text-xl">
                {isCommentPosted ? '✅' : isCommentPosting ? '⏳' : '💬'}
              </span>
              <ComicText size={0.7} color="white">
                {isCommentPosted ? 'Commented!' : isCommentPosting ? 'Commenting…' : 'Comment Results'}
              </ComicText>
            </button>
          )}
          <button
            onClick={() => onNavigate('leaderboard', { gameId: statistics.gameId })}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg w-full sm:w-auto sm:min-w-[220px]"
            style={{ backgroundColor: colors.primary }}
          >
            <span className="text-lg">🏆</span>
            <ComicText size={0.7} color="white">
              Leaderboard
            </ComicText>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameResultsPage;

