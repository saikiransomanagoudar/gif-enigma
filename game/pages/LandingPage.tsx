import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { NavigationProps } from '../lib/types';
import PageTransition from '../../src/utils/PageTransition';
import { motion } from 'framer-motion';

export const LandingPage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [redditUsername, setRedditUsername] = useState<string>('');
  const [ifhover, setHover] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isboardOpen, setboardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const isHandlingRequest = useRef(false); // Prevent duplicate requests

  useEffect(() => {
    setIsLoading(false);
    setShowSuccessMessage(false);
    isHandlingRequest.current = false; // Reset on mount
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
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GET_CURRENT_USER_RESULT') {
        if (event.data.success) {
          setRedditUsername(event.data.user?.username || '');
        } else {
          setRedditUsername('');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePlayClick = () => {
    // Prevent multiple simultaneous requests
    if (isHandlingRequest.current) {
      return;
    }
    
    isHandlingRequest.current = true;
    setIsLoading(true);
    setShowSuccessMessage(false);
    let retryCount = 0;
    const maxRetries = 3;
    let timeoutId: NodeJS.Timeout | null = null;
    let isHandled = false;

    const tryFindGame = () => {
      const handleGameResponse = (event: MessageEvent) => {
        let message = event.data;
        if (message && message.type === 'devvit-message' && message.data?.message) {
          message = message.data.message;
        } else if (message && message.type === 'devvit-message' && message.data) {
          message = message.data;
        }

        if (message.type === 'GET_RANDOM_GAME_RESULT') {
          // Prevent handling the same response multiple times
          if (isHandled) return;
          isHandled = true;
          
          window.removeEventListener('message', handleGameResponse);
          if (timeoutId) clearTimeout(timeoutId);

          if (message.success && message.result && message.result.game) {
            const game = message.result.game;
            const redditPostId = game.redditPostId;

            if (redditPostId && game.gifs && Array.isArray(game.gifs) && game.gifs.length > 0 && game.word) {
              // Show brief success message and navigate quickly
              setShowSuccessMessage(true);
              
              // Use shorter delay (150ms) - just enough to see the animation
              setTimeout(() => {
                // Reset state before navigation
                setIsLoading(false);
                setShowSuccessMessage(false);
                isHandlingRequest.current = false;
                
                // Navigate immediately after state reset
                window.parent.postMessage(
                  {
                    type: 'NAVIGATE_TO_POST',
                    data: { postId: redditPostId },
                  },
                  '*'
                );
              }, 150);
            } else if (retryCount < maxRetries) {
              isHandled = false; // Reset for retry
              retryCount++;
              setTimeout(tryFindGame, 500);
            } else {
              setIsLoading(false);
              setShowSuccessMessage(false);
              isHandlingRequest.current = false; // Reset flag
              alert('⚠️ Could not find a valid game to play. Please try again.');
            }
          } else if (retryCount < maxRetries) {
            isHandled = false; // Reset for retry
            retryCount++;
            setTimeout(tryFindGame, 500);
          } else {
            setIsLoading(false);
            setShowSuccessMessage(false);
            isHandlingRequest.current = false; // Reset flag
            
            // Show contextual error messages
            const result = message.result || {};
            let errorMessage = '';
            
            if (result.hasPlayedAll) {
              errorMessage = '🎉 Amazing! You\'ve completed all games! Check back later for new challenges.';
            } else if (result.error && result.error.includes('No games available yet')) {
              errorMessage = '🎨 No games yet! Be the first to create one by tapping "Let\'s Build"';
            } else if (result.error) {
              errorMessage = result.error;
            } else if (message.error) {
              errorMessage = message.error;
            } else {
              errorMessage = '😕 No games available right now. Try creating one!';
            }
            
            alert(errorMessage);
          }
        }
      };

      window.removeEventListener('message', handleGameResponse);
      window.addEventListener('message', handleGameResponse);

      window.parent.postMessage(
        {
          type: 'GET_RANDOM_GAME',
          data: {
            username: redditUsername || 'anonymous',
            preferUserCreated: true,
          },
        },
        '*'
      );

      // Safety timeout - if no response after 10 seconds, reset UI
      timeoutId = setTimeout(() => {
        if (isMounted.current && !isHandled) {
          window.removeEventListener('message', handleGameResponse);
          setIsLoading(false);
          setShowSuccessMessage(false);
          isHandlingRequest.current = false; // Reset flag
          alert('Request timed out. Please try again.');
        }
      }, 10000);
    };

    tryFindGame();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';

  return (
    <PageTransition>
      {isInitialLoading && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
        </div>
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
      <div
        className={`${backgroundColor} mt-[-12px] mb-0 min-h-screen w-full p-5 pb-15 select-none`}
      >
        <div className="relative flex flex-col items-center p-4 max-sm:mt-[20px]">
          {/* Leaderboard Button */}
          <motion.button
            className={`absolute top-2 right-2 mt-5 cursor-pointer rounded-lg px-4 py-3 text-lg select-none ${
              ifhover === 'btn1'
                ? 'border-1 border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-border border-1 bg-[#E8E5DA] text-black'
            }`}
            onClick={() => {
              onNavigate('leaderboard');
              setboardOpen(!isboardOpen);
            }}
            onMouseEnter={() => setHover('btn1')}
            onMouseLeave={() => setHover(null)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <span className={`mt-1 inline-flex items-center`}>
              <div className={`${isboardOpen ? 'text-2xl' : ''}`}>🏆</div>

              <ComicText
                size={0.8}
                className={`hidden sm:block ${isboardOpen ? 'text-lg' : ''}`}
                color={ifhover === 'btn1' ? 'white' : 'black'}
              >
                &nbsp;Leaderboard
              </ComicText>
            </span>
          </motion.button>

          <div className="mt-5 flex w-full cursor-default flex-col items-center justify-center gap-2 select-none">
            <div className="mt-[-21px] mb-[21px] ml-10 flex gap-2 p-5">
              <span className="text-3xl">🎬</span>
              <span className="text-3xl">❓</span>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-[-35px] mb-[15px] cursor-default select-none"
            >
              <ComicText size={3} color={colors.primary}>
                GIF Enigma
              </ComicText>
            </motion.h2>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
            </motion.h2>
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
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <img
              src="/landing-page/lets-build.gif"
              alt="Create GIF"
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
              onClick={() => onNavigate('howToPlay')}
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
