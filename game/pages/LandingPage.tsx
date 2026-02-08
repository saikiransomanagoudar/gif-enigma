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
          errorMessage = '🎉 Amazing! you have played all games, more games to come';
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

  const handleHowToPlayClick = async (event: React.MouseEvent) => {
    try {
      await requestExpandedMode(event.nativeEvent, 'howToPlay');
    } catch (error) {
      onNavigate('howToPlay');
    }
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
      <div className={`${backgroundColor} mt-0 mb-0 min-h-screen w-full p-5 pb-15 select-none`}>
        <div className="relative flex flex-col items-center p-4 pt-6 max-sm:mt-0 md:pt-12">
          {/* Leaderboard Button */}
          <motion.button
            className={`absolute top-4 right-2 mt-2 cursor-pointer rounded-lg px-4 py-3 text-lg select-none max-sm:top-2 max-sm:mt-2 max-sm:px-3 max-sm:py-2 md:top-4 md:px-2.5 md:py-2 md:text-base ${
              ifhover === 'btn1'
                ? 'border-1 border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-border border-1 bg-[#E8E5DA] text-black'
            }`}
            onClick={async (event) => {
              try {
                await requestExpandedMode(event.nativeEvent, 'leaderboard');
              } catch (error) {
                onNavigate('leaderboard');
              }
            }}
            onMouseEnter={() => setHover('btn1')}
            onMouseLeave={() => setHover(null)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <span className={`mt-1 inline-flex items-center`}>
              <div className="md:text-sm">🏆</div>

              <ComicText
                size={0.8}
                className={`hidden sm:block md:text-sm`}
                color={ifhover === 'btn1' ? 'white' : 'black'}
              >
                &nbsp;Leaderboard
              </ComicText>
            </span>
          </motion.button>

          <div className="mt-16 flex w-full cursor-default flex-col items-center justify-center gap-2 select-none max-sm:mt-16">
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mb-[7px] cursor-default select-none"
            >
              <ComicText size={2.5} color={colors.primary}>
                GIF Enigma
              </ComicText>
            </motion.h2>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            ></motion.h2>
          </div>
        </div>

        <div className="mb-[15px] flex flex-row items-center justify-center gap-5 max-sm:mt-[20px]">
          <motion.div
            className="relative w-[30%] cursor-pointer p-2 max-sm:w-[100%] lg:w-[21%]"
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
              className={`block w-full rounded-2xl ${isLoading ? 'opacity-50' : ''}`}
            />
            <div className="absolute top-[85%] left-1/2 w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-sm text-white max-sm:w-[90px] max-sm:px-2 max-sm:py-1 max-sm:text-[10px]">
              {isLoading ? 'Loading...' : 'Tap to Play →'}
            </div>
          </motion.div>

          <motion.div
            className="relative w-[30%] cursor-pointer p-2 max-sm:w-[100%] lg:w-[21%]"
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
              className="block w-full rounded-2xl"
            />
            <div className="absolute top-[85%] left-1/2 w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-sm text-white max-sm:w-[90px] max-sm:px-2 max-sm:py-1 max-sm:text-[10px]">
              Tap to Create →
            </div>
          </motion.div>
        </div>

        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <div className="mt-6 mb-[21px] flex w-full items-center justify-center">
            <button
              className={`relative flex w-[53.1%] cursor-pointer items-center justify-center gap-2 rounded-lg border-1 px-4 py-3 text-lg hover:scale-105 max-sm:w-[90%] max-sm:py-3 lg:w-[30%] ${ifhover === 'btn2' ? 'border-[#FF4500] bg-[#FF4500] !text-white' : 'border-black bg-[#E8E5DA] !text-black'}`}
              onClick={handleHowToPlayClick}
              onMouseEnter={() => setHover('btn2')}
              onMouseLeave={() => setHover(null)}
            >
              <span className="inline-flex items-center justify-center">
                <ComicText
                  size={0.8}
                  className={`text-lg max-sm:text-[1px] ${ifhover === 'btn2' ? '!text-white' : '!text-black'}`}
                >
                  🤔 How to play?
                </ComicText>
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};
