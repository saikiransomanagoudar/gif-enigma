import React, { useState, useEffect } from 'react';
import { ComicText } from '../lib/fonts';
import PageTransition from '../../src/utils/PageTransition';
import { NavigationProps, Page } from '../lib/types';
import { motion } from 'framer-motion';

export interface HowToPlayPageProps extends NavigationProps {
  onNavigate: (page: Page) => void;
}

export const HowToPlayPage: React.FC<HowToPlayPageProps> = ({ onNavigate }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [_isInitialLoading, setIsInitialLoading] = useState(true);
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    setIsInitialLoading(true);
    const animationTimeout = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsInitialLoading(false);
      });
    });

    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => {
      cancelAnimationFrame(animationTimeout);
      darkModeQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  const backgroundColor = isDarkMode ? 'bg-gray-900' : 'bg-[#E8E5DA]';
  const textColor = isDarkMode ? 'text-[#E8E5DA]' : 'text-gray-900';

  return (
    <PageTransition>      
      <motion.div
        className={`${backgroundColor} min-h-screen w-full p-6 font-[ComicText]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <motion.header
          className="mb-6 flex items-center justify-between border-b-2 border-gray-400 pb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <motion.div
            onClick={() => onNavigate('landing')}
            className={`flex cursor-pointer items-center space-x-2 rounded-full bg-[#FF4500] px-3 py-1.5 text-[#FF4500] shadow-[0_4px_6px_2px_rgba(0,0,0,0.3)] transition duration-200 hover:scale-105`}
          >
            <span className="mr-1 text-sm text-white">👈</span>
            <ComicText size={0.5} color="white">
              Back
            </ComicText>
          </motion.div>
          <h2 className={`ml-[30px] text-center text-3xl font-bold ${textColor}`}>
            <ComicText size={1.75} className="text-[#E8E5DA]">
              How to play?
            </ComicText>
          </h2>
          <div className="flex-1" />
        </motion.header>

        <motion.div
          className={`${textColor} space-y-10`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <section>
            <motion.h3
              className="text-primary mb-4 text-center text-2xl font-bold"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.22 }}
            >
              <ComicText size={1.25} className="text-[#E8E5DA]">
                Decoding
              </ComicText>
            </motion.h3>
            <div className="space-y-4">
              {['🖼️', '👁️', '💡', '⌨️'].map((icon, index) => (
                <motion.div
                  key={index}
                  className="flex items-center"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.3 + index * 0.08 }}
                >
                  <span className="mr-4 text-3xl">
                    {icon}
                  </span>
                  <ComicText size={0.9} className="text-lg">
                    {
                      [
                        'Each puzzle has 4 GIFs, only the first one is revealed at the start.',
                        'Stuck? Reveal more GIFs or letters as hints (each hint costs points).',
                        'Type your guess, the fewer hints you use, the higher your score.',
                        'Guess your answer and climb the leaderboard.',
                      ][index]
                    }
                  </ComicText>
                </motion.div>
              ))}
            </div>
          </section>

          <motion.section
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.65 }}
          >
            <motion.h3
              className="mb-4 text-center text-2xl font-bold text-[#E8E5DA]"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.72 }}
            >
              <ComicText size={1.25} className="">
                Creating
              </ComicText>
            </motion.h3>
            <div className="space-y-4">
              {['✏️', '🔎', '🖼️', '🎮'].map((icon, index) => (
                <motion.div
                  key={index}
                  className="flex items-center"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.8 + index * 0.08 }}
                >
                  <span className="mr-4 text-3xl">{icon}</span>
                  <ComicText size={0.9} className="text-lg">
                    {
                      [
                        'Pick a secret word/phrase, and shuffle through suggestions until you find the one you like.',
                        'Your selected word/phrase will come with synonyms that serve as search query for GIFs in each slot.',
                        'Choose 4 GIFs, one for each synonym level (from abstract to direct match).',
                        'Hit "Create GIF Enigma" to post your puzzle and earn XP for your creation.',
                      ][index]
                    }
                  </ComicText>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </motion.div>

        {/* <motion.div
          className="mt-10 flex flex-col items-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 1.4 }}
        >
          <motion.button
            onClick={() => onNavigate('landing')}
            className="transform cursor-pointer rounded-full bg-[#E8E5DA] px-8 py-4 text-lg text-white shadow-[0_4px_6px_2px_rgba(0,0,0,0.3)] transition duration-200 hover:scale-105"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 1.5 }}
          >
            <ComicText>Get Started!</ComicText>
          </motion.button>
        </motion.div> */}
      </motion.div>
    </PageTransition>
  );
};

export default HowToPlayPage;
