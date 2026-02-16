import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { NavigationProps } from '../lib/types';
import PageTransition from '../../src/utils/PageTransition';
import { motion } from 'framer-motion';
// @ts-ignore
import { navigateTo, requestExpandedMode } from '@devvit/web/client';
import { getCurrentUser, getRandomGame } from '../lib/api';

export const LandingPage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [redditUsername, setRedditUsername] = useState<string>('');
  const [ifhover, setHover] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
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

  useEffect(() => {
    setIsLoading(false);
    setShowSuccessMessage(false);
    isHandlingRequest.current = false;
    
    // Preload GIF images to prevent loading issues
    const preloadImages = [
      '/landing-page/lets-play.gif',
      '/landing-page/lets-build.gif'
    ];
    
    preloadImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsLoading(false);
        setShowSuccessMessage(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      setIsLoading(false);
      setShowSuccessMessage(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const data = await getCurrentUser();
        if (data.success && data.username) {
          setRedditUsername(data.username);
        } else {
          setRedditUsername('');
        }
      } catch (error) {
        setRedditUsername('');
      }
    }

    fetchCurrentUser();
  }, []);

  const handlePlayClick = async () => {
    if (isHandlingRequest.current) {
      return;
    }

    isHandlingRequest.current = true;
    setIsLoading(true);
    setShowSuccessMessage(false);

    try {
      const response = await getRandomGame(redditUsername || 'anonymous', {
        useStickyNavigation: true,
      });

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
            setIsLoading(false);
            setShowSuccessMessage(false);
            isHandlingRequest.current = false;
            navigateTo(postUrl);
          }, 150);
        } else {
          setIsLoading(false);
          setShowSuccessMessage(false);
          isHandlingRequest.current = false;
        }
      } else {
        setIsLoading(false);
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
      setIsLoading(false);
      setShowSuccessMessage(false);
      isHandlingRequest.current = false;
    }
  };

  const handleHowToPlayClick = (event: React.MouseEvent) => {
    requestExpandedMode(event.nativeEvent, 'howToPlay')
      .catch(() => {
        onNavigate('howToPlay');
      });
  };

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';

  return (
    <PageTransition>
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

      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
          {!showSuccessMessage ? (
            <>
              <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
              <div className="mt-4">
                <ComicText size={0.8} color="white">
                  Finding a game for you...
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
      )}
      <div className={`${backgroundColor} flex h-screen w-full flex-col overflow-hidden select-none`}>
        {/* Header with Leaderboard Button */}
        <div className="relative flex flex-shrink-0 items-center justify-center px-4 py-3">
          {/* Leaderboard Button */}
          <motion.button
            type="button"
            className={`absolute top-5 right-5 cursor-pointer rounded-lg px-3.5 py-3.5 sm:px-5 sm:py-3 text-base select-none ${
              ifhover === 'btn1'
                ? 'border-1 border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-border border-1 bg-[#E8E5DA] text-black'
            }`}
            onClick={(event) => {
              requestExpandedMode(event.nativeEvent, 'leaderboard')
                .catch(() => {
                  onNavigate('leaderboard');
                });
            }}
            onMouseEnter={() => setHover('btn1')}
            onMouseLeave={() => setHover(null)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <span className="inline-flex items-center">
              <div className="text-lg sm:text-sm">🏆</div>
              <ComicText
                size={0.9}
                className="hidden sm:block text-sm"
                color={ifhover === 'btn1' ? 'white' : 'black'}
              >
                &nbsp;Leaderboard
              </ComicText>
            </span>
          </motion.button>
        </div>

        {/* Main Content - Flexbox centered */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-4">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <ComicText size={2.2} color={colors.primary}>
              GIF Enigma
            </ComicText>
          </motion.div>

          {/* GIF Buttons */}
          <div className="flex w-full max-w-[480px] flex-row items-center justify-center gap-4 sm:gap-6">
            <motion.div
              className="relative w-full max-w-[220px] cursor-pointer flex-1"
              onClick={handlePlayClick}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <img
                src="/landing-page/lets-play.gif"
                alt="Play GIF"
                width="400"
                height="400"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.retried) {
                    target.dataset.retried = 'true';
                    target.src = `/landing-page/lets-play.gif?t=${Date.now()}`;
                  }
                }}
                className={`block w-full rounded-2xl ${isLoading ? 'opacity-50' : ''}`}
              />
              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/60 px-3 py-2 text-center text-sm text-white sm:px-4">
                {isLoading ? 'Loading...' : 'Tap to Play →'}
              </div>
            </motion.div>

            <motion.div
              className="relative w-full max-w-[220px] cursor-pointer flex-1"
              onClick={() => onNavigate('category')}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <img
                src="/landing-page/lets-build.gif"
                alt="Create GIF"
                width="400"
                height="400"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.retried) {
                    target.dataset.retried = 'true';
                    target.src = `/landing-page/lets-build.gif?t=${Date.now()}`;
                  }
                }}
                className="block w-full rounded-2xl"
              />
              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/60 px-3 py-2 text-center text-sm text-white sm:px-4">
                Tap to Create →
              </div>
            </motion.div>
          </div>

          {/* How to Play Button */}
          <motion.div
            className="w-full max-w-[480px] flex-shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <button
              type="button"
              className={`w-full flex cursor-pointer items-center justify-center gap-2 rounded-lg border-1 px-6 py-3 text-lg hover:scale-105 ${ifhover === 'btn2' ? 'border-[#FF4500] bg-[#FF4500] !text-white' : 'border-black bg-[#E8E5DA] !text-black'}`}
              onClick={handleHowToPlayClick}
              onMouseEnter={() => setHover('btn2')}
              onMouseLeave={() => setHover(null)}
            >
              <ComicText
                size={0.9}
                color={ifhover === 'btn2' ? 'white' : 'black'}
              >
                🤔 How to play?
              </ComicText>
            </button>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};
