import React, { useState, useEffect } from 'react';
import { NavigationProps } from '../App';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';

import PageTransition from '../../src/utils/PageTransition';
import { motion } from 'framer-motion';

export const LandingPage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [username, setUsername] = useState<string>('');
  const [redditUsername, setRedditUsername] = useState<string>('');
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [ifhover, setHover] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isboardOpen, setboardOpen] = useState(false);

  useEffect(() => {
    // Detect dark mode using matchMedia
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Set initial state
    setIsDarkMode(darkModeQuery.matches);

    // Listen for theme changes
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeQuery.addEventListener('change', handleThemeChange);

    return () => {
      darkModeQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch('https://oauth.reddit.com/api/v1/me', {
          method: 'GET',
          headers: {
            'Authorization': `bearer YOUR_ACCESS_TOKEN`,
            'User-Agent': 'YOUR_USER_AGENT',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
        setUsername(data.name);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUsername();
  }, []);

  useEffect(() => {
    if (!hasFetched) {
      setHasFetched(true);
      fetch('/api/currentUser')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.username) {
              setUsername(data.username); // Set general username
            }
            if (data.redditUsername) {
              setRedditUsername(data.redditUsername); // Set Reddit username if available
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching user:', error);
        });
    }
  }, [hasFetched]);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]'; // Dark mode background
  const textColor = isDarkMode
    ? 'text-transparent bg-gradient-to-t from-[#E5E5E5] to-[#00BBFF] bg-clip-text'
    : 'text-black'; // Dark mode text

  return (
    <PageTransition>
      <div className={`${backgroundColor} mt-[-32px] h-full w-full rounded-lg p-5`}>
        <div className="relative flex flex-col items-center p-4 max-sm:mt-[20px]">
          {/* Leaderboard Button */}
          <motion.button
            className={`absolute top-2 right-2 mt-5 cursor-pointer rounded-lg px-4 py-3 text-lg ${
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
                &nbsp;LEADERBOARD
              </ComicText>
            </span>
          </motion.button>

          {/* Center Container for Icons and Title */}
          <div className="mt-5 flex w-full flex-col items-center justify-center gap-2">
            {/* Icons */}
            <div className="mt-[-21px] ml-10 flex gap-2 p-5">
              <span className="text-3xl">🎬</span>
              <span className="text-3xl">❓</span>
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-[-15px]"
            >
              <ComicText size={3} color={colors.primary}>
                GIF ENIGMA
              </ComicText>
            </motion.h2>

            {/* Subtitle */}
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <ComicText
                size={0.8}
                color={textColor}
                className={`mt-[-15px] p-1 text-center ${isDarkMode ? 'bg-gradient-to-t from-[#FFFFFF] to-[#00DDFF] bg-clip-text text-transparent' : 'text-black'}`}
              >
                Can you guess the hidden word from a GIF?
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
                className={`mt-[10px] mb-[10px] p-1 text-center ${isDarkMode ? 'bg-gradient-to-t from-[#FFFFFF] to-[#00DDFF] bg-clip-text text-transparent' : 'text-black'}`}
              >
                Hi {redditUsername ? `u/${redditUsername}` : username ? `u/${username}` : 'there'},
                are you ready to unravel the message from GIFs?
              </ComicText>
            </motion.h2>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-row items-center justify-center gap-5 max-sm:mt-[20px]">
          {/* Play GIF */}
          <motion.div
            className="relative w-[30%] cursor-pointer p-2 max-sm:w-[100%] lg:w-[21%]"
            onClick={() => onNavigate('game')}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <img
              src="/landing-page/lets-play.gif"
              alt="Play GIF"
              className="block w-full rounded-2xl"
            />
            <div className="absolute top-[85%] left-1/2 w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-sm text-white max-sm:w-[90px] max-sm:px-2 max-sm:py-1 max-sm:text-[10px]">
              Tap to Play →
            </div>
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
              src="/landing-page/lets-build.gif"
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
          <div className="mt-6 flex w-full items-center justify-center">
            <button
              className={`relative flex w-[53.1%] cursor-pointer items-center justify-center gap-2 rounded-lg border-1 px-4 py-3 text-lg max-sm:w-[90%] max-sm:py-3 lg:w-[30%] ${ifhover === 'btn2' ? 'border-[#FF4500] bg-[#FF4500] !text-white' : 'border-black bg-[#E8E5DA] !text-black'}`}
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
                  &nbsp;HOW THIS GAME WORKS? 🤔
                </ComicText>
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};
