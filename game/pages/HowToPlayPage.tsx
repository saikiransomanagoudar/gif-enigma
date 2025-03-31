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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);

    setIsInitialLoading(true);

    // Hide loading indicator after a small delay
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
      {isInitialLoading && (
        <div className="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      )}
      <motion.div
        className={`${backgroundColor} min-h-screen w-full p-6 font-[ComicText]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <motion.header
          className="mb-6 flex items-center justify-between border-b-2 border-gray-400 pb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
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
              How to Play?
            </ComicText>
          </h2>
          <div className="flex-1" />
        </motion.header>

        {/* Main Content */}
        <motion.div
          className={`${textColor} space-y-10`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Play Mode Section */}
          <section>
            <motion.h3
              className="text-primary mb-4 text-center text-2xl font-bold"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <ComicText size={1.25} className="text-[#E8E5DA]">
                Play Mode
              </ComicText>
            </motion.h3>
            <div className="space-y-4">
              {['🎬', '👁️', '💡', '⌨️', '🏆'].map((_icon, index) => (
                <motion.div
                  key={index}
                  className="flex items-center"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 + index * 0.2 }}
                >
                  <span className="mr-4 text-3xl">
                    {['🖼️', '⌨️', '💡', '⚖️', '🔠', '🏆', '🎯'][index]}
                  </span>
                  <ComicText className="text-lg">
                    {
                      [
                        'Solve either user generated or system generated GIF enigmas in the feed. Each question will have 4 hidden GIFs as hints.',
                        'First GIF is shown initially. Further GIFs are revealed as progressive hints that closely matches the secret word, but this comes at a cost of losing points.',
                        'There are also word/phrase hints that reveal letters (costs more than GIF hints). If you need help, reveal more GIFs or word/phrase as hints.',
                        'Type your guess in the input field and submit.',
                        'If you guess correctly, you will earn points based on the number of hints used. Higher the hints, lower the points.',
                      ][index]
                    }
                  </ComicText>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Create Mode Section */}
          <motion.section
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.4 }}
          >
            <motion.h3
              className="mb-4 text-center text-2xl font-bold text-[#E8E5DA]"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.6 }}
              
            >
              <ComicText size={1.25} className="">
                Create Mode
              </ComicText>
            </motion.h3>
            <div className="space-y-4">
              {['✏️', '🔎', '🖼️', '🎮'].map((icon, index) => (
                <motion.div
                  key={index}
                  className="flex items-center"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.8 + index * 0.2 }}
                >
                  <span className="mr-4 text-3xl">{icon}</span>
                  <ComicText className="text-lg">
                    {
                      [
                        'Select a secret word/phrase from the recommended list of words/phrases for others to guess. You can cycle through the list.',
                        'Your selected word/phrase will come with synonyms that serve as search query for GIFs.',
                        'Select 4 GIFs (from Abstract to Direct match) for your secret word (choose wisely!).',
                        'Create a game, and let others guess your word/phrase!',
                      ][index]
                    }
                  </ComicText>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </motion.div>

        {/* Footer Call-to-Action */}
        <motion.div
          className="mt-10 flex flex-col items-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 2 }}
        >
          {/* <motion.h3
            className="text-primary text-center text-2xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.2 }}
          >
            <ComicText>Decode the clues, manage your points, and crack the GIF enigma!</ComicText>
          </motion.h3> */}
          <motion.button
            onClick={() => onNavigate('landing')}
            className="transform cursor-pointer rounded-full bg-[#E8E5DA] px-8 py-4 text-lg text-white shadow-[0_4px_6px_2px_rgba(0,0,0,0.3)] transition duration-200 hover:scale-105"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 2.4 }}
          >
            <ComicText>Get Started!</ComicText>
          </motion.button>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
};

export default HowToPlayPage;
