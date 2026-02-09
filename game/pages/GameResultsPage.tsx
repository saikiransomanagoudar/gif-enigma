import React, { useState, useEffect, useRef } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import { GameStatistics, NavigationProps, Page } from '../lib/types';
import { filterGuesses } from '../lib/profanityFilter';
import { motion } from 'framer-motion';
// @ts-ignore
import { navigateTo, requestExpandedMode } from '@devvit/web/client';

// Refactored: Import API functions
import {
  getCurrentUser,
  getRandomGame,
  checkUserComment,
  getGameState,
  getGameStatistics,
  getCreatorBonusStats,
  postCompletionComment,
} from '../lib/api';

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
  const [creatorBonusStats, setCreatorBonusStats] = useState<{
    totalBonus: number;
    completions: number;
  } | null>(null);

  const [isFindingGame, setIsFindingGame] = useState(false);
  const [gameFound, setGameFound] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [commentedInThisSession, setCommentedInThisSession] = useState(false);
  const isHandlingPlayAgainRequest = useRef(false);
  const normalizePostId = (id: string) => (id.startsWith('t3_') ? id.slice(3) : id);
  const normalizePostIdForLookup = (id: string) => (id.startsWith('t3_') ? id : `t3_${id}`);
  const isGameId = (id: string) => id.startsWith('game_');
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

  // Refactored: Use getRandomGame API + navigateTo (same pattern as LandingPage)
  const handlePlayAgainClick = async (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (isHandlingPlayAgainRequest.current) {
      return;
    }

    isHandlingPlayAgainRequest.current = true;
    setIsFindingGame(true);
    setGameFound(false);

    try {
      const response = await getRandomGame(username || 'anonymous', { useStickyNavigation: true });

      const resolvedGame = response.game || response.result?.game;
      if (response.success && resolvedGame) {
        const game = resolvedGame;
        const postUrl = buildPostUrl(game);

        if (postUrl && game.gifs && Array.isArray(game.gifs) && game.gifs.length > 0 && game.word) {
          setGameFound(true);

          setTimeout(() => {
            setIsFindingGame(false);
            isHandlingPlayAgainRequest.current = false;
            navigateTo(postUrl);
          }, 800);
        } else {
          setIsFindingGame(false);
          isHandlingPlayAgainRequest.current = false;
        }
      } else {
        const result = response.result || {};
        let errorMessage = '';

        if (result.hasPlayedAll) {
          errorMessage = '🎉 Amazing! you have played all games, more games to come';
          setIsFindingGame(false);
          isHandlingPlayAgainRequest.current = false;
          setToastMessage(errorMessage);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
          return;
        }

        setIsFindingGame(false);
        isHandlingPlayAgainRequest.current = false;
        alert(errorMessage);
      }
    } catch (error) {
      setIsFindingGame(false);
      isHandlingPlayAgainRequest.current = false;
      alert('Failed to find a game. Please try again.');
    }
  };

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';

  // Refactored: Get current username using API function
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const data = await getCurrentUser();
        if (data.success && data.user?.username) {
          setUsername(data.user.username);
        } else {
          setUsername('anonymous');
        }
      } catch (error) {
        setUsername('anonymous');
      }
    }
    fetchCurrentUser();
  }, []);

  // Refactored: Check if user has already commented using API function
  useEffect(() => {
    if (username && gameId && username !== 'anonymous') {
      async function checkComment() {
        try {
          const data = await checkUserComment(username!, gameId!);

          if (data.success && data.hasCommented) {
            setHasAlreadyCommented(true);
            setIsCommentPosted(true);
          } else {
            setHasAlreadyCommented(false);
          }
        } catch (error) {
          // error
        }
      }
      checkComment();
    }
  }, [username, gameId]);

  // Refactored: Fetch game state using API function
  useEffect(() => {
    if (username && gameId) {
      if (username !== 'anonymous') {
        async function fetchGameState() {
          try {
            const data = await getGameState(username!, gameId!);
            if (data.success && data.state?.playerState) {
              setGameState(data.state.playerState);
              setIsGameStateLoaded(true);
            } else {
              setGameState(null);
              setIsGameStateLoaded(true);
            }
          } catch (error) {
            setGameState(null);
            setIsGameStateLoaded(true);
          }
        }
        fetchGameState();
      } else {
        setIsGameStateLoaded(true);
        setGameState(null);
      }
    }
  }, [username, gameId]);

  useEffect(() => {
    if (statistics?.acceptedSynonyms) {
      setAcceptedSynonyms(statistics.acceptedSynonyms);
    }
  }, [statistics]);

  // Refactored: Fetch statistics using API function
  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
      setIsLoading(false);
      return;
    }

    async function fetchStatistics() {
      try {
        let resolvedGameId = gameId as string;

        if (!isGameId(resolvedGameId)) {
          const normalizedPostId = normalizePostIdForLookup(resolvedGameId);
          const response = await fetch(`/api/post/${encodeURIComponent(normalizedPostId)}/game`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (data.success && data.gameId) {
            resolvedGameId = data.gameId;
          }
        }

        const statsData = await getGameStatistics(resolvedGameId);
        setIsLoading(false);
        if (statsData.success && statsData.statistics) {
          setStatistics(statsData.statistics);
          setError(null);
        } else {
          if (statsData.error === 'Game not found') {
            setError(
              'This game data has expired (common in playtest mode). Your score was saved, but detailed stats are no longer available.'
            );
          } else {
            setError(statsData.error || 'Failed to load statistics');
          }
        }
      } catch (error) {
        setIsLoading(false);
        setError('Failed to load statistics');
      }
    }

    fetchStatistics();
  }, [gameId]);

  // Refactored: Fetch creator bonus stats using API function
  useEffect(() => {
    if (
      gameId &&
      username &&
      statistics?.creatorUsername &&
      username === statistics.creatorUsername
    ) {
      async function fetchCreatorStats() {
        const data = await getCreatorBonusStats(gameId!);
        if (data.success && typeof data.totalBonus === 'number') {
          setCreatorBonusStats({
            totalBonus: data.totalBonus,
            completions: data.completions || 0,
          });
        }
      }
      fetchCreatorStats();
    }
  }, [gameId, username, statistics?.creatorUsername]);

  const handleBackClick = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    onNavigate('landing');
  };

  const isGuessCorrect = (guess: string, answer: string): boolean => {
    const normalizeString = (str: string) =>
      str.replace(/\s+/g, '').replace(/[^\w]/g, '').trim().toUpperCase();

    const normalizedGuess = normalizeString(guess);
    const normalizedAnswer = normalizeString(answer);

    if (normalizedGuess === normalizedAnswer) {
      return true;
    }

    if (normalizedGuess.length !== normalizedAnswer.length) {
      return false;
    }

    if (acceptedSynonyms && acceptedSynonyms.length > 0) {
      const normalizedSynonyms = acceptedSynonyms.map((syn) => normalizeString(syn));

      return normalizedSynonyms.some(
        (syn) => syn === normalizedGuess && syn.length === normalizedAnswer.length
      );
    }

    return false;
  };

  const formatGuessLikeAnswer = (guess: string, answer: string): string => {
    const normalizeString = (str: string) =>
      str.replace(/\s+/g, '').replace(/[^\w]/g, '').trim().toUpperCase();

    const normalizedGuess = normalizeString(guess);
    const normalizedAnswer = normalizeString(answer);

    if (normalizedGuess !== normalizedAnswer) {
      return guess;
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

  // Refactored: Handle post comment using API function
  const handlePostComment = async (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!gameId || !username) {
      return;
    }
    if (isCommentPosting || isCommentPosted) {
      return;
    }

    const gifHintCount = gameState?.gifHintCount || 1;
    const gifHintsUsed = gifHintCount > 1 ? gifHintCount - 1 : 0;
    const actualGuesses = gameState?.numGuesses || 1;

    setIsCommentPosting(true);

    try {
      const data = await postCompletionComment(
        gameId,
        username,
        actualGuesses,
        gifHintsUsed,
        statistics?.redditPostId
      );

      setIsCommentPosting(false);

      if (data.success) {
        if (data.alreadyPosted) {
          setHasAlreadyCommented(true);
          setIsCommentPosted(true);
          setCommentedInThisSession(true);
        } else {
          setIsCommentPosted(true);
          setCommentedInThisSession(true);
        }
      } else {
        alert(data.error || 'Failed to post comment');
      }
    } catch (error) {
      setIsCommentPosting(false);
      alert('Failed to post comment');
    }
  };

  if (isLoading || error || !statistics) {
    return (
      <div className={`${backgroundColor} flex min-h-screen items-center justify-center`}>
        <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`${backgroundColor} flex min-h-screen flex-col p-5`}>
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 z-[10000] -translate-x-1/2 transform"
        >
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FF6B35] px-6 py-4 shadow-2xl backdrop-blur-sm">
            <span className="text-2xl">🎉</span>
            <ComicText size={0.75} color="white">
              {toastMessage}
            </ComicText>
          </div>
        </motion.div>
      )}

      <header className="relative mb-3 flex w-full items-center justify-between">
        <button
          type="button"
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

      <div className="mb-5 text-center">
        <div
          style={{
            fontFamily: 'Comic Sans MS, Comic Sans, cursive',
            fontSize: '24px',
            color: '#EAB308',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}
        >
          {statistics.answer.toUpperCase()}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
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

        <div className="rounded-xl bg-white/5 p-6 backdrop-blur-sm dark:bg-gray-800/20">
          <div
            className={`mb-4 flex items-center ${username && statistics?.creatorUsername && username === statistics.creatorUsername && statistics.creatorUsername !== 'gif-enigma' && creatorBonusStats && creatorBonusStats.totalBonus > 0 ? 'justify-between' : 'justify-center'}`}
          >
            <ComicText size={0.9} color={colors.primary}>
              Decode attempts
            </ComicText>
            {(() => {
              return null;
            })()}
            {username &&
              statistics?.creatorUsername &&
              username === statistics.creatorUsername &&
              statistics.creatorUsername !== 'gif-enigma' &&
              creatorBonusStats &&
              creatorBonusStats.totalBonus > 0 && (
                <div
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2.5 py-1"
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(252, 211, 77, 0.4) 0%, rgba(251, 191, 36, 0.3) 100%)',
                  }}
                >
                  <span className="text-sm">✨</span>
                  <div style={{ fontWeight: 'bold' }}>
                    <ComicText size={0.5} color="#D97706">
                      +{creatorBonusStats.totalBonus} XP
                    </ComicText>
                  </div>
                </div>
              )}
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
                  const normalizeLength = (str: string) =>
                    str.replace(/\s+/g, '').replace(/[^\w]/g, '').length;
                  return normalizeLength(guessData.guess) === normalizeLength(statistics.answer);
                })
                .sort((a, b) => {
                  const aIsCorrect = isGuessCorrect(a.guess, statistics.answer);
                  const bIsCorrect = isGuessCorrect(b.guess, statistics.answer);

                  const aIsExactMatch =
                    a.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() ===
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();
                  const bIsExactMatch =
                    b.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() ===
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();

                  // Priority 1: Exact matches first
                  if (aIsExactMatch && !bIsExactMatch) return -1;
                  if (!aIsExactMatch && bIsExactMatch) return 1;

                  // Priority 2: Close matches (correct but not exact)
                  if (aIsCorrect && !aIsExactMatch && !bIsCorrect) return -1;
                  if (bIsCorrect && !bIsExactMatch && !aIsCorrect) return 1;

                  // Priority 3: Within same category, sort by count descending
                  return b.count - a.count;
                })
                .slice(0, 10)
                .map((guessData, index) => {
                  const isCorrect = isGuessCorrect(guessData.guess, statistics.answer);
                  const isExactMatch =
                    guessData.guess.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase() ===
                    statistics.answer.replace(/\s+/g, '').replace(/[^\w]/g, '').toUpperCase();

                  const displayGuess = isCorrect
                    ? formatGuessLikeAnswer(guessData.guess, statistics.answer).toUpperCase()
                    : guessData.guess.toUpperCase();

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 'bold' }}>
                          <ComicText size={0.7} color={isCorrect ? '#10B981' : '#CA8A04'}>
                            {displayGuess}
                          </ComicText>
                        </div>
                        {isCorrect && (
                          <div className="flex items-center gap-1">
                            <span className="text-lg">{isExactMatch ? '✅' : '✨'}</span>
                            {!isExactMatch && (
                              <div
                                className="rounded-full border px-2 py-0.5"
                                style={{
                                  backgroundColor: isDarkMode
                                    ? 'rgba(167, 139, 250, 0.2)'
                                    : 'rgba(124, 58, 237, 0.15)',
                                  borderColor: isDarkMode ? '#A78BFA' : '#7C3AED',
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
            const hasGivenUp = gameState?.hasGivenUp === true || gameState?.gifHintCount === 999;
            const isCreator =
              statistics?.creatorUsername && username === statistics.creatorUsername;

            const shouldShow =
              isGameStateLoaded &&
              !hasGivenUp &&
              !isCreator &&
              (commentedInThisSession || !hasAlreadyCommented);

            return shouldShow;
          })() && (
            <button
              type="button"
              onClick={handlePostComment}
              disabled={isCommentPosting || isCommentPosted || !username}
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-300 disabled:cursor-not-allowed sm:w-auto sm:min-w-[220px] ${
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
              <div style={{ fontFamily: 'Comic Sans MS, cursive, sans-serif', fontSize: '16px' }}>
                {isCommentPosted
                  ? 'Commented!'
                  : isCommentPosting
                    ? 'Commenting…'
                    : 'Comment Results'}
              </div>
            </button>
          )}

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onNavigate('leaderboard', { gameId: statistics.gameId });
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg active:translate-y-0 active:scale-95 sm:w-auto sm:min-w-[220px] sm:flex-1"
              style={{ backgroundColor: colors.primary }}
            >
              <span className="text-lg">🏆</span>
              <ComicText size={0.7} color="white">
                Leaderboard
              </ComicText>
            </button>

            <button
              type="button"
              onClick={handlePlayAgainClick}
              disabled={isFindingGame || gameFound}
              className="play-again-button flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-white sm:w-auto sm:min-w-[220px] sm:flex-1"
              style={{
                backgroundColor: '#10B981',
                opacity: isFindingGame || gameFound ? 0.8 : 1,
              }}
            >
              <span className="text-xl">{gameFound ? '🎮' : isFindingGame ? '⏳' : '🎮'}</span>
              <ComicText size={0.7} color="white">
                {gameFound
                  ? 'Game found!'
                  : isFindingGame
                    ? 'Finding game...'
                    : gameState?.hasGivenUp
                      ? 'Try another'
                      : statistics?.creatorUsername && username === statistics.creatorUsername
                        ? 'Play a new game'
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
