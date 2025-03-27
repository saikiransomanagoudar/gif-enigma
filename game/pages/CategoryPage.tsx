import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import * as transitions from '../../src/utils/transitions';
import { NavigationProps, Page } from '../lib/types';
export type CategoryType = 'Movies' | 'Gaming' | 'Books' | 'General';

export interface CategoryNavigationProps extends NavigationProps {
  onNavigate: (page: Page) => void;
  onCategorySelect?: (category: CategoryType) => void;
}

export const CategoryPage: React.FC<CategoryNavigationProps> = ({
  onNavigate,
  onCategorySelect,
}) => {
  const [hoverCategory, setHoverCategory] = useState<CategoryType | null>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  // Refs for elements we'll animate
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const categoryGridRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';

  useEffect(() => {
      // Detect dark mode
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(darkModeQuery.matches);
      const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      darkModeQuery.addEventListener('change', handleThemeChange);
      return () => darkModeQuery.removeEventListener('change', handleThemeChange);
    }, []);

  const categories: {
    type: CategoryType;
    icon: string;
    bgColor: string;
    description: string;
  }[] = [
    {
      type: 'Movies',
      icon: '🎬',
      bgColor: '#FF5E5B',
      description: 'Film titles, characters, quotes',
    },
    {
      type: 'Gaming',
      icon: '🎮',
      bgColor: '#8AC926',
      description: 'Games, characters, gaming terms',
    },
    {
      type: 'Books',
      icon: '📚',
      bgColor: '#1982C4',
      description: 'Titles, authors, characters & quotes',
    },
    {
      type: 'General',
      icon: '🌐',
      bgColor: '#6A4C93',
      description: 'Anything and everything!',
    },
  ];

  // Setup initial animations when component mounts
  useEffect(() => {
    // Mark page as loaded
    setIsPageLoaded(true);

    // Animate header elements with a staggered delay
    if (headerRef.current) {
      transitions.fadeIn(headerRef.current, {
        duration: 400,
        direction: 'up',
        distance: 'sm',
      });
    }

    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 500,
        delay: 200,
        direction: 'up',
      });
    }

    if (subtitleRef.current) {
      transitions.animateElement(subtitleRef.current, {
        duration: 500,
        delay: 300,
        direction: 'up',
      });
    }

    if (backButtonRef.current) {
      transitions.animateElement(backButtonRef.current, {
        duration: 400,
        delay: 100,
        direction: 'left',
      });
    }

    // Animate category cards with staggered delay
    setTimeout(() => {
      const categoryCards = document.querySelectorAll('.category-card');
      categoryCards.forEach((card, index) => {
        transitions.animateElement(card as HTMLElement, {
          duration: 500,
          delay: 400 + index * 150,
          direction: 'up',
          distance: 'md',
        });
      });
    }, 300);
  }, []);

  const handleBackClick = () => {
    // Fade out elements before navigating
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 300 });
    }

    // Fade out category cards with staggered effect
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach((card, index) => {
      transitions.fadeOut(card as HTMLElement, {
        duration: 300,
        delay: index * 50,
      });
    });

    // Navigate after animations complete
    setTimeout(() => {
      onNavigate('landing');
    }, 450); // Allow time for animations to finish
  };

  const handleCategorySelect = (category: CategoryType) => {
    // Add exit animation before navigating
    const categoryCards = document.querySelectorAll('.category-card');
    const header = headerRef.current;

    // Fade out category cards first
    categoryCards.forEach((card, index) => {
      transitions.fadeOut(card as HTMLElement, {
        duration: 300,
        delay: index * 50,
      });
    });

    // Then fade out header
    if (header) {
      transitions.fadeOut(header, {
        duration: 300,
        delay: 200,
      });
    }

    // Wait for animations to complete before navigating
    setTimeout(() => {
      if (onCategorySelect) {
        onCategorySelect(category);
      }
      onNavigate('create');
    }, 600);
  };

  return (
    <div
    className={`${backgroundColor} select-none flex min-h-screen flex-col items-center p-5 transition-opacity duration-500`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      {/* Header section */}
      <header
        ref={headerRef}
        className="mb-5 flex w-full max-w-4xl translate-y-4 transform items-center justify-between opacity-0 transition-all duration-500"
      >
        <button
          ref={backButtonRef}
          onClick={handleBackClick}
          className={`${isDarkMode ? 'bg-[#FF4500] text-white' :`bg-[#FF4500] text-black`} left-4 flex transform cursor-pointer items-center rounded-full border-none px-3 py-1.5 opacity-0 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg`}
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 md:pr-12 lg:pr-20 max-sm:mt-[-20px] max-sm:ml-[12px]">
          <div
            ref={titleRef}
            className="translate-y-4 transform opacity-0 transition-all duration-500"
          >
            <ComicText size={1.2} color={colors.primary} align="center">
              Create GIF Enigma
            </ComicText>
          </div>
          <div
            ref={subtitleRef}
            className="translate-y-4 transform opacity-0 transition-all duration-500"
          >
            <ComicText
              size={0.8}
              color={colors.textSecondary}
              className="mt-2 text-sm sm:text-base md:text-lg"
            >
              Choose category for your enigma
            </ComicText>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
      <div ref={categoryGridRef} className="grid grid-cols-1 gap-4 max-sm:gap-1 max-sm:mt-[-20px] sm:grid-cols-2 lg:grid-cols-2">
          {categories.map((category) => (
            <button
              key={category.type}
              onClick={() => handleCategorySelect(category.type)}
              onMouseEnter={() => setHoverCategory(category.type)}
              onMouseLeave={() => setHoverCategory(null)}
              className="max-sm:h-4/5 category-card translate-y-8 transform cursor-pointer rounded-xl border-none p-0 opacity-0 transition-all duration-300 hover:-translate-y-1 hover:scale-102 hover:shadow-lg"
              style={{
                overflow: 'hidden',
                transform:
                  hoverCategory === category.type
                    ? 'scale(1.03) translateY(-4px)'
                    : 'scale(1) translateY(0)',
                boxShadow:
                  hoverCategory === category.type ? '0 10px 25px rgba(0, 0, 0, 0.1)' : 'none',
              }}
            >
              <div
                className="flex h-full flex-col items-center justify-center p-6"
                style={{
                  backgroundColor: category.bgColor,
                  border: `3px solid ${hoverCategory === category.type ? 'white' : 'transparent'}`,
                  borderRadius: '12px',
                }}
              >
                <div className="mb-3 text-4xl">{category.icon}</div>
                <ComicText size={1} color="white" className="mb-2 text-sm sm:text-base md:text-lg">
                  {category.type}
                </ComicText>
                <ComicText size={0.6} color="white" className="text-center">
                  {category.description}
                </ComicText>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};
