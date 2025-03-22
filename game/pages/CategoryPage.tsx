import React, { useState } from 'react';
import { NavigationProps } from '../App';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';

export type CategoryType = 'Movies' | 'Gaming' | 'Books' | 'General';

export interface CategoryNavigationProps extends NavigationProps {
  onCategorySelect?: (category: CategoryType) => void;
}

export const CategoryPage: React.FC<CategoryNavigationProps> = ({
  onNavigate,
  onCategorySelect,
}) => {
  const [hoverCategory, setHoverCategory] = useState<CategoryType | null>(null);

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

  const handleCategorySelect = (category: CategoryType) => {
    if (onCategorySelect) {
      onCategorySelect(category);
    }
    onNavigate('create');
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-5">
      {/* <header className="relative mb-6 p-4"> */}
      <header className="mb-5 flex w-full max-w-4xl items-center justify-between">
        <button
          onClick={() => onNavigate('landing')}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 md:pr-12 lg:pr-20">
          <ComicText size={1.2} color={colors.primary} align="center">
            Create GIF Enigma
          </ComicText>
          <ComicText
            size={0.8}
            color={colors.textSecondary}
            className="mt-2 text-sm sm:text-base md:text-lg dark:text-gray-300"
          >
            Choose category for your enigma
          </ComicText>
        </div>
      </header>
      {/* </div> */}

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {categories.map((category) => (
            <button
              key={category.type}
              onClick={() => handleCategorySelect(category.type)}
              onMouseEnter={() => setHoverCategory(category.type)}
              onMouseLeave={() => setHoverCategory(null)}
              className="cursor-pointer rounded-xl border-none p-0 transition-all duration-300 hover:-translate-y-1 hover:scale-102 hover:shadow-lg"
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
