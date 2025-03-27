import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Detect dark mode
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    // Request Reddit username
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GET_CURRENT_USER_RESULT') {
        if (event.data.success) {
          setRedditUsername(event.data.user?.username || '');
        } else {
          console.error('Error fetching user:', event.data.error);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePlayClick = () => {
    setIsLoading(true);
    
    // Get list of previously played games from localStorage
    let playedGameIds: string[] = [];
    try {
      const savedGameIds = localStorage.getItem('playedGameIds');
      if (savedGameIds) {
        playedGameIds = JSON.parse(savedGameIds);
      }
    } catch (e) {
      console.error('Error parsing playedGameIds from localStorage:', e);
    }

    // Request a random game, preferring user-created ones
    window.parent.postMessage(
      { 
        type: 'GET_RANDOM_GAME',
        data: { 
          excludeIds: playedGameIds,
          preferUserCreated: true 
        }
      }, 
      '*'
    );

    // Listen for the game response
    const handleGameResponse = (event: MessageEvent) => {
      let message = event.data;
      
      // Unwrap if message is in a devvit envelope
      if (message && message.type === 'devvit-message' && message.data?.message) {
        message = message.data.message;
      }
      
      if (message.type === 'GET_RANDOM_GAME_RESULT') {
        setIsLoading(false);
        window.removeEventListener('message', handleGameResponse);
        
        if (message.success && message.game) {
          console.log('Random game loaded:', message.game.id);
          // Navigate to game page with the loaded game
          onNavigate('game', { gameId: message.game.id });
        } else {
          console.error('Failed to load random game:', message.error);
          // Navigate to game page anyway, the GamePage will handle the error
          onNavigate('game');
        }
      }
    };
    
    window.addEventListener('message', handleGameResponse);
  };

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]'; // Dark mode background
  const textColor = isDarkMode
    ? 'text-transparent bg-gradient-to-t from-[#E5E5E5] to-[#00BBFF] bg-clip-text'
    : 'text-black';

  return (
    <PageTransition>
      
      <div className={`${backgroundColor} mt-[-12px] p-5 select-none `}>
        <div className="relative flex flex-col items-center p-4 max-sm:mt-[20px]">
          {/* Leaderboard Button */}
          <motion.button
            className={`absolute top-2 right-2 mt-5 select-none cursor-pointer rounded-lg px-4 py-3 text-lg ${
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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

          {/* Center Container for Icons and Title */}
          <div className="mt-5 flex w-full flex-col items-center justify-center gap-2 select-none cursor-default">
            {/* Icons */}
            <div className="mt-[-21px] ml-10 flex gap-2 p-5 mb-[21px]">
              <span className="text-3xl">🎬</span>
              <span className="text-3xl">❓</span>
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-[-35px] select-none cursor-default mb-[15px]"
            >
              <ComicText size={3} color={colors.primary}>
                GIF Enigma
              </ComicText>
            </motion.h2>

            {/* Welcome Message */}
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              <ComicText
                size={0.8}
                color={textColor}
                className={`select-none cursor-default mt-[50px] mb-[20px] p-1 text-center ${isDarkMode ? 'bg-gradient-to-t from-[#FFFFFF] to-[#00DDFF] bg-clip-text text-transparent' : 'text-black'}`}
              >
                Hi {redditUsername ? `u/${redditUsername}` : 'there'}, are you ready to unravel the secret word/phrase from GIFs?
              </ComicText>
            </motion.h2>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-row items-center justify-center gap-5 max-sm:mt-[20px] mb-[15px]">
          {/* Play GIF */}
          <motion.div
            className="relative w-[30%] cursor-pointer p-2 max-sm:w-[100%] lg:w-[21%]"
            onClick={handlePlayClick}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <img
              src="/asset-gif/lets-play.gif"
              alt="Play GIF"
              className={`block w-full rounded-2xl ${isLoading ? 'opacity-50' : ''}`}
            />
            <div className="absolute top-[85%] left-1/2 w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-sm text-white max-sm:w-[90px] max-sm:px-2 max-sm:py-1 max-sm:text-[10px]">
              {isLoading ? 'Loading...' : 'Tap to Play →'}
            </div>
            {isLoading && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-blue-500"></div>
              </div>
            )}
          </motion.div>

          {/* Create GIF */}
          <motion.div
            className="relative w-[30%] cursor-pointer p-2 max-sm:w-[100%] lg:w-[21%]"
            onClick={() => onNavigate('category')}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.4 }}
          >
            <img
              src="/asset-gif/lets-build.gif"
              alt="Create GIF"
              className="block w-full rounded-2xl"
            />
            <div className="absolute top-[85%] left-1/2 w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-sm text-white max-sm:w-[90px] max-sm:px-2 max-sm:py-1 max-sm:text-[10px]">
              Tap to Create →
            </div>
          </motion.div>
        </div>

        {/* Secondary Action Buttons */}
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.6 }}
        >
          {/* Secondary Action Buttons */}
          <div className="mt-6 flex w-full items-center justify-center mb-[21px]">
            <button
              className={`hover:scale-105 relative flex w-[53.1%] cursor-pointer items-center justify-center gap-2 rounded-lg border-1 px-4 py-3 text-lg max-sm:w-[90%] max-sm:py-3 lg:w-[30%] ${ifhover === 'btn2' ? 'border-[#FF4500] bg-[#FF4500] !text-white' : 'border-black bg-[#E8E5DA] !text-black'}`}
              onClick={() => onNavigate('howToPlay')}
              onMouseEnter={() => setHover('btn2')}
              onMouseLeave={() => setHover(null)}
            >
              <span className="inline-flex items-center justify-center">
                <div className="text-xl">ℹ</div>
                <ComicText
                  size={0.8}
                  className={`text-lg max-sm:text-[1px] ${ifhover === 'btn2' ? '!text-white' : '!text-black'}`}
                >
                  &nbsp;How this game works? 🤔
                </ComicText>
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};