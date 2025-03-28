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
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);

    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => {
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
              How to Play
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
              {[
                "Start by viewing the initial GIF clue that hints at a secret word or phrase.",
                "Enter your guess into the input field.",
                "If you're stuck, reveal extra GIF hints—up to 4 total.",
                "GIF hints cost points: -10 after 2 hints, -20 after 3, and -40 after 4.",
                "Alternatively, use word/phrase hints that reveal letters. Note: these incur a higher penalty based on answer length.",
                "You begin with 100 points—using fewer hints earns you a higher score.",
                "Decipher the enigma by balancing clues and your score!"
              ].map((instruction, index) => (
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
                    {instruction}
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
              className="text-[#E8E5DA] mb-4 text-center text-2xl font-bold"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.6 }}
            >
              <ComicText size={1.25} className="text-[#E8E5DA]">
                Creator Mode
              </ComicText>
            </motion.h3>
            <div className="space-y-4">
              {['✏️', '🔎', '🖼️', '💾'].map((icon, index) => (
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
                        'Choose a secret word or phrase for others to guess.',
                        'Search for GIFs that serve as creative clues.',
                        'Select 4 GIFs that progressively hint your secret.',
                        'Share your puzzle on the subreddit for community fun!'
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
          <motion.h3
            className="text-primary text-center text-2xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.2 }}
          >
            <ComicText>Decode the clues, manage your points, and crack the GIF enigma!</ComicText>
          </motion.h3>
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
