import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { Modal } from '../components/Modal';
import { CategoryType } from './CategoryPage';
import { NavigationProps, Page } from '../lib/types';
import * as transitions from '../../src/utils/transitions';

export interface TenorGifResult {
  id: string;
  title: string;
  media_formats: {
    gif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    tinygif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    mediumgif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    [key: string]:
      | {
          url: string;
          dims: number[];
          duration: number;
          preview: string;
          size: number;
        }
      | undefined;
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

const getGifUrl = (gif: TenorGifResult | null): string => {
  return gif?.url || '';
};

export interface CreatePageProps extends NavigationProps {
  context: any;
  category?: CategoryType;
  onNavigate: (page: Page) => void;
}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate, category = 'General' }) => {
  const [inputType, setInputType] = useState<'word' | 'phrase'>('word');
  const [currentCategory, setCurrentCategory] = useState<CategoryType>(category);

  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [currentRecIndex, setCurrentRecIndex] = useState<number>(0);
  const [secretInput, setSecretInput] = useState<string>('');
  const [synonyms, setSynonyms] = useState<string[][]>([]);
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState<boolean>(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  
  // Cache for recommendations to avoid repeated API calls
  const recommendationsCache = useRef<{ [key: string]: string[] }>({});
  const synonymsCache = useRef<{ [key: string]: string[][] }>({});

  // GIF states
  // @ts-ignore
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<TenorGifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<(TenorGifResult | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);
  const [selectedGifInModal, setSelectedGifInModal] = useState<TenorGifResult | null>(null);

  // UI states
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // @ts-ignore
  const [message, setMessage] = useState<string>('');
  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isPageLoaded, setIsPageLoaded] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const gifGridRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

  useEffect(() => {
    if (category) {
      setCurrentCategory(category);
    }
    // Clear synonyms immediately when input type changes to avoid delay
    setSynonyms([]);
    setIsLoadingSynonyms(false);
    // Clear cache when input type changes to avoid wrong data
    const cacheKey = `${currentCategory}-${inputType}`;
    delete recommendationsCache.current[cacheKey];
    fetchRecommendations();
  }, [currentCategory, inputType]);

  const getFallbackRecommendations = () => {
    const fallbacks = {
      'General': {
        word: ['ELEPHANT', 'BUTTERFLY', 'RAINBOW', 'MOUNTAIN', 'OCEAN', 'FOREST', 'CASTLE', 'DRAGON', 'MAGIC', 'DREAM'],
        phrase: ['ONCE UPON A TIME', 'HAPPY BIRTHDAY', 'GOOD MORNING', 'SEE YOU LATER', 'THANK YOU VERY MUCH', 'I LOVE YOU', 'HOW ARE YOU', 'WHAT TIME IS IT', 'HAVE A NICE DAY', 'GOOD NIGHT']
      },
      'Movies': {
        word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN', 'FROZEN', 'TOYSTORY', 'PIRATES', 'WIZARD', 'GHOSTBUSTERS'],
        phrase: ['MAY THE FORCE BE WITH YOU', 'I AM YOUR FATHER', 'TO INFINITY AND BEYOND', 'HERE IS JOHNNY', 'I WILL BE BACK', 'SHOW ME THE MONEY', 'ELEMENTARY MY DEAR WATSON', 'LIFE IS LIKE A BOX OF CHOCOLATES', 'I AM SPARTACUS', 'HOUSTON WE HAVE A PROBLEM']
      },
      'Gaming': {
        word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE', 'MINECRAFT', 'POKEMON', 'PACMAN', 'TETRIS', 'DONKEYKONG'],
        phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE', 'PLAYER ONE READY', 'CONTINUE GAME', 'SAVE GAME', 'LOAD GAME', 'PAUSE GAME', 'RESUME GAME', 'QUIT GAME']
      },
      'Books': {
        word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA', 'FRANKENSTEIN', 'ALICE', 'WONDERLAND', 'ROBINHOOD', 'MULAN'],
        phrase: ['ONCE UPON A TIME', 'THE END', 'CHAPTER ONE', 'TO BE CONTINUED', 'THE ADVENTURE BEGINS', 'THE MYSTERY DEEPENS', 'THE FINAL CHAPTER', 'THE LEGEND LIVES ON', 'THE STORY CONTINUES', 'THE TALE IS TOLD']
      }
    };

    const categoryData = fallbacks[currentCategory] || fallbacks['General'];
    return categoryData[inputType] || categoryData['word'];
  };

  const fetchRecommendations = async () => {
    const cacheKey = `${currentCategory}-${inputType}`;
    
    // Check cache first
    if (recommendationsCache.current[cacheKey]) {
      const cachedData = recommendationsCache.current[cacheKey];
      setRecommendations(cachedData);
      setCurrentRecIndex(0);
      setSecretInput(cachedData[0]);
      fetchSynonyms(cachedData[0]);
      return;
    }
    
    setIsLoadingRecommendations(true);
    
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_RECOMMENDATIONS',
        data: {
          category: currentCategory,
          inputType: inputType,
          count: 20,
        },
      },
      '*'
    );

    // Set a shorter timeout and use fallback data
    setTimeout(() => {
      if (isLoadingRecommendations && !secretInput) {
        setIsLoadingRecommendations(false);
        const fallbackData = getFallbackRecommendations();
        setRecommendations(fallbackData);
        setCurrentRecIndex(0);
        setSecretInput(fallbackData[0]);
        fetchSynonyms(fallbackData[0]);
      }
    }, 5000); // 5 second timeout
  };

  const getFallbackSynonyms = (word: string) => {
    const synonymMap: { [key: string]: string[][] } = {
      'ELEPHANT': [['animal', 'large', 'trunk', 'gray'], ['mammal', 'big', 'ivory', 'herd'], ['creature', 'huge', 'tusk', 'safari'], ['beast', 'massive', 'memory', 'zoo']],
      'BUTTERFLY': [['insect', 'wings', 'colorful', 'fly'], ['caterpillar', 'metamorphosis', 'beautiful', 'flutter'], ['pollinate', 'delicate', 'spring', 'garden'], ['transform', 'graceful', 'pattern', 'flower']],
      'RAINBOW': [['colors', 'rain', 'sky', 'arc'], ['spectrum', 'prism', 'light', 'beautiful'], ['seven', 'vibrant', 'nature', 'hope'], ['weather', 'bright', 'magical', 'end']],
      'MOUNTAIN': [['peak', 'high', 'climb', 'rock'], ['summit', 'elevation', 'hiking', 'snow'], ['range', 'altitude', 'view', 'nature'], ['hill', 'slope', 'adventure', 'trail']],
      'OCEAN': [['sea', 'water', 'waves', 'blue'], ['deep', 'vast', 'marine', 'salt'], ['current', 'tide', 'shore', 'fish'], ['aquatic', 'huge', 'surf', 'boat']],
      'STARWARS': [['space', 'lightsaber', 'force', 'jedi'], ['galaxy', 'darth', 'vader', 'rebel'], ['yoda', 'luke', 'princess', 'leia'], ['death', 'star', 'empire', 'hope']],
      'POKEMON': [['pikachu', 'catch', 'trainer', 'battle'], ['ash', 'gym', 'evolution', 'pokeball'], ['gotta', 'catch', 'em', 'all'], ['monster', 'creature', 'adventure', 'friend']],
      'HARRY': [['potter', 'wizard', 'hogwarts', 'magic'], ['spell', 'wand', 'voldemort', 'hermione'], ['ron', 'weasley', 'quidditch', 'dumbledore'], ['gryffindor', 'invisibility', 'cloak', 'phoenix']]
    };

    return synonymMap[word.toUpperCase()] || [
      ['think', 'guess', 'solve', 'answer'],
      ['brain', 'mind', 'logic', 'reason'], 
      ['puzzle', 'mystery', 'riddle', 'challenge'],
      ['find', 'discover', 'reveal', 'uncover']
    ];
  };

  const fetchSynonyms = async (word: string) => {
    // Check cache first
    if (synonymsCache.current[word]) {
      setSynonyms(synonymsCache.current[word]);
      return;
    }
    
    setIsLoadingSynonyms(true);
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_SYNONYMS',
        data: { word },
      },
      '*'
    );

    // Fallback for synonyms too
    setTimeout(() => {
      if (isLoadingSynonyms) {
        setIsLoadingSynonyms(false);
        const fallbackSynonyms = getFallbackSynonyms(word);
        // Cache the fallback synonyms
        synonymsCache.current[word] = fallbackSynonyms;
        setSynonyms(fallbackSynonyms);
      }
    }, 3000); // 3 second timeout
  };

  const getNextRecommendation = () => {
    const secretWordElement = document.querySelector('.secret-word-value');
    const hintElements = document.querySelectorAll('.hint-text');

    if (secretWordElement) {
      secretWordElement.classList.add('opacity-0', 'translate-y-2');
    }

    hintElements.forEach((element) => {
      (element as HTMLElement).classList.add('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
      const nextIndex = (currentRecIndex + 1) % recommendations.length;
      setCurrentRecIndex(nextIndex);
      setSecretInput(recommendations[nextIndex]);
      fetchSynonyms(recommendations[nextIndex]);

      setTimeout(() => {
        if (secretWordElement) {
          secretWordElement.classList.remove('opacity-0', 'translate-y-2');
        }

        hintElements.forEach((element, index) => {
          setTimeout(() => {
            (element as HTMLElement).classList.remove('opacity-0', 'translate-y-2');
          }, index * 50);
        });
      }, 50);
    }, 300);
  };

  useEffect(() => {
    setIsPageLoaded(true);

    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 500,
        delay: 150,
        direction: 'up',
      });
    }

    if (headerRef.current) {
      transitions.fadeIn(headerRef.current, {
        duration: 400,
        direction: 'up',
        distance: 'sm',
      });
    }

    if (mainContentRef.current) {
      transitions.animateElement(mainContentRef.current, {
        duration: 500,
        delay: 200,
        direction: 'up',
      });
    }

    if (gifGridRef.current) {
      transitions.animateElement(gifGridRef.current, {
        duration: 500,
        delay: 400,
        direction: 'up',
      });
    }

    if (submitButtonRef.current) {
      transitions.animateElement(submitButtonRef.current, {
        duration: 500,
        delay: 600,
        direction: 'up',
      });
    }
    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      }
      if (!msg || typeof msg !== 'object') return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (msg.type === 'GET_GEMINI_RECOMMENDATIONS_RESULT') {
        setIsLoadingRecommendations(false);
        if (msg.success && Array.isArray(msg.result)) {
          const filtered = msg.result.filter((r: string) => r.length >= 5);
          const cacheKey = `${currentCategory}-${inputType}`;
          recommendationsCache.current[cacheKey] = filtered;
          setRecommendations(filtered);
          setCurrentRecIndex(0);
          if (filtered.length > 0) {
            setSecretInput(filtered[0]);
            // Fetch synonyms immediately for the new recommendation
            fetchSynonyms(filtered[0]);
          }
        } else {
          setRecommendations([]);
          setSecretInput('');
          // Clear synonyms if no recommendations
          setSynonyms([]);
        }
      }

      if (msg.type === 'GET_GEMINI_SYNONYMS_RESULT') {
        setIsLoadingSynonyms(false);
        if (msg.success && Array.isArray(msg.result)) {
          // Cache successful synonyms response
          if (secretInput) {
            synonymsCache.current[secretInput] = msg.result;
          }
          setSynonyms(msg.result);
        } else {
          setSynonyms([]);
        }
      }

      if (msg.type === 'SEARCH_TENOR_GIFS_RESULT') {
        setIsSearching(false);
        if (msg.success && Array.isArray(msg.results)) {
          setGifs(msg.results);
        } else {
          setGifs([]);
        }
      }

      if (msg.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);
        if (msg.success && msg.result && msg.result.success) {
          setShowSuccessModal(true);
        } else {
          setMessage(`Failed to create game: ${msg.error || msg.result?.error || 'Unknown error'}`);
          setMessageType('error');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const searchGifs = async (term: string) => {
    if (!term) return;
    setGifs([]);
    setIsSearching(true);
    setSelectedGifInModal(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try {
      window.parent.postMessage(
        {
          type: 'SEARCH_TENOR_GIFS',
          data: { query: term, limit: 16 },
        },
        '*'
      );
      timeoutRef.current = setTimeout(() => {
        setIsSearching(false);
        setMessage('Search timed out. Please try again.');
        setMessageType('error');
      }, 8000);
    } catch (error) {
      setIsSearching(false);
      setMessage('Error starting search. Please try again.');
      setMessageType('error');
    }
  };

  // const uploadGif = (gif: TenorGifResult) => {
  //   const gifUrl = getGifUrl(gif);
  //   if (!gifUrl) {
  //     setMessage('Unable to load this GIF. Please try another one.');
  //     setMessageType('error');
  //     return;
  //   }
  //   window.parent.postMessage(
  //     {
  //       type: 'UPLOAD_TENOR_GIF',
  //       data: { tenorGifUrl: gifUrl },
  //     },
  //     '*'
  //   );
  // };

  const handleBackClick = () => {
    // Fade out elements before navigating
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 300 });
    }
    if (mainContentRef.current) {
      transitions.fadeOut(mainContentRef.current, { duration: 300, delay: 100 });
    }

    setTimeout(() => {
      onNavigate('category');
    }, 400);
  };

  const selectGifForSlot = (gif: TenorGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      const gifUrl = getGifUrl(gif);
      if (!gifUrl) {
        setMessage('Unable to load this GIF. Please try another one.');
        setMessageType('error');
        return;
      }
      const cleanGif = JSON.parse(JSON.stringify(gif));
      const newSelectedGifs = [...selectedGifs];
      newSelectedGifs[selectedGifIndex] = cleanGif;
      setSelectedGifs(newSelectedGifs);
      setShowSearchInput(false);
      setSelectedGifInModal(null);
      setGifs([]);
      setMessageType('success');
    }
  };

  const removeGifFromSlot = (index: number) => {
    const newSelectedGifs = [...selectedGifs];
    newSelectedGifs[index] = null;
    setSelectedGifs(newSelectedGifs);
  };

  const submitGame = () => {
    const validGifs = selectedGifs.filter((gif) => gif !== null);
    if (!secretInput) {
      setMessage(`No valid recommended ${inputType} selected yet.`);
      setMessageType('error');
      return;
    }
    if (validGifs.length !== 4) {
      setMessage(`Please select exactly 4 GIFs. You've selected ${validGifs.length} so far.`);
      setMessageType('error');
      return;
    }

    setIsCreating(true);
    setMessage('Creating your GIF Enigma game...');
    setMessageType('info');

    try {
      const wordArray = secretInput.split('');
      const maskCount = Math.floor((wordArray.length * 2) / 3);
      const indicesToMask = new Set<number>();
      while (indicesToMask.size < maskCount) {
        indicesToMask.add(Math.floor(Math.random() * wordArray.length));
      }
      const maskedWord = wordArray
        .map((char, i) => (indicesToMask.has(i) && char !== ' ' ? '_' : char))
        .join('');

      const questionText =
        inputType === 'word'
          ? 'Can you guess the word from these GIF clues?'
          : 'Can you guess the phrase from these GIF clues?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      window.parent.postMessage(
        {
          type: 'SAVE_GAME',
          data: {
            word: secretInput,
            category: currentCategory,
            maskedWord,
            questionText,
            gifs: gifUrls,
          },
        },
        '*'
      );
    } catch (error) {
      setIsCreating(false);
      setMessage(
        `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessageType('error');
    }
  };

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    // Detect dark mode
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);
  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';
  const categoryColor = isDarkMode ? 'text-yellow-400' : 'text-black';
  const renderGifGrid = () => (
    <div className="mb-4" ref={gifGridRef}>
      <div className="mb-2 flex items-center justify-between">
        <ComicText size={0.8} color={colors.primary}>
          GIF Hints
        </ComicText>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, index) => {
          const gif = selectedGifs[index];
          const defaultSynonym = synonyms[index]?.[0] || '';
          const boxNumber = index + 1;

          return (
            <div
              key={index}
              className={`${backgroundColor} gif-slot-${index} relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-500 transition-all duration-300 sm:h-32 sm:w-48 md:h-56 md:w-56 lg:h-60 lg:w-60 xl:h-64 xl:w-64 2xl:h-64 2xl:w-64`}
              style={{
                border: gif ? 'none' : `3px solid ${colors.secondary}`,
              }}
            >
              {/* Number indicator */}
              <div className="bg-opacity-70 absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                <ComicText size={0.5} color="white">
                  #{boxNumber}
                </ComicText>
              </div>

              {gif ? (
                <div className="relative h-full w-full">
                  <button
                    onClick={() => removeGifFromSlot(index)}
                    className="absolute top-2 right-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all duration-200 hover:scale-110"
                  >
                    ✕
                  </button>
                  <img
                    src={getGifUrl(gif)}
                    alt={`GIF ${index + 1}`}
                    className="h-full w-full object-cover transition-opacity duration-500"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!isLoadingSynonyms && defaultSynonym) {
                      setSelectedGifIndex(index);
                      setShowSearchInput(true);
                      setSearchTerm(defaultSynonym);
                      setMessage('');
                      setMessageType('info');
                      searchGifs(defaultSynonym);
                    }
                  }}
                  className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-2 text-center transition-all duration-200 ${
                    isLoadingSynonyms && !defaultSynonym ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'
                  }`}
                >
                  <div className="mb-1 text-2xl transition-transform duration-300 hover:rotate-12">
                    {isLoadingSynonyms && !defaultSynonym ? '⏳' : '➕'}
                  </div>
                  <div className="transition-all duration-300">
                    <ComicText size={0.6} color={colors.textSecondary}>
                      {isLoadingSynonyms && !defaultSynonym ? (
                        <span className="hint-text transition-all duration-300 ease-in-out">
                          Loading synonyms...
                        </span>
                      ) : (
                        <>
                          {/* {secretInput && (
                            <span className="block">
                              <span className="inline-block">{inputType === 'word' ? 'Word:' : 'Phrase:'}</span>{' '}
                              <span className={`hint-text transition-all duration-300 ease-in-out ${categoryColor}`}>
                                {secretInput}
                              </span>
                            </span>
                          )} */}
                          {defaultSynonym ? (
                            <span className="block mt-1">
                              <span className="inline-block">Synonym:</span>{' '}
                              <span className={`hint-text transition-all duration-300 ease-in-out text-yellow-400 ${categoryColor}`}>
                                {defaultSynonym}
                              </span>
                            </span>
                          ) : (
                            !secretInput && `Add GIF #${index + 1}`
                          )}
                        </>
                      )}
                    </ComicText>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const InputTypeToggle = () => (
    <div className="flex items-center justify-center">
      <div
        className="relative flex h-10 items-center overflow-hidden rounded-full"
        style={{
          backgroundColor: '#2D3748',
          border: `2px solid ${colors.primary}`,
          width: '160px',
          position: 'relative',
          minHeight: '40px',
        }}
      >
        <div
          className="absolute h-full w-1/2 rounded-full transition-all duration-300 ease-in-out"
          style={{
            backgroundColor: colors.primary,
            left: inputType === 'word' ? '0' : '50%',
            zIndex: 1,
          }}
        />
        <button
          onClick={() => setInputType('word')}
          className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center transition-all duration-200"
        >
          <ComicText size={0.6} color={inputType === 'word' ? 'white' : colors.textSecondary}>
            Word
          </ComicText>
        </button>
        <button
          onClick={() => setInputType('phrase')}
          className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center transition-all duration-200"
        >
          <ComicText size={0.6} color={inputType === 'phrase' ? 'white' : colors.textSecondary}>
            Phrase
          </ComicText>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`${backgroundColor} flex min-h-screen flex-col items-center p-5 transition-opacity duration-500 select-none`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      <Modal
        title="Select GIF of your choice"
        isOpen={showSearchInput}
        onClose={() => {
          transitions.fadeOut(document.querySelector('.modal-content'), {
            duration: 300,
            onComplete: () => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              setShowSearchInput(false);
              setIsSearching(false);
            },
          });
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setShowSearchInput(false);
          setIsSearching(false);
          setSelectedGifInModal(null);
        }}
        onConfirm={() => {
          if (selectedGifInModal) {
            selectGifForSlot(selectedGifInModal);
          }
        }}
      >
        <div className="flex flex-col gap-4">
           {isSearching && (
             <div className="flex flex-col items-center justify-center py-4">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
               <ComicText size={0.7} color="#60A5FA" className="mt-5 text-center">
                 Searching for GIFs...
               </ComicText>
             </div>
           )}
          {!isSearching && gifs.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => {
                  // const url = uploadedGifUrls[gif.id] || getGifUrl(gif);
                  const url = getGifUrl(gif);
                  if (!url) return null;
                  return (
                    <div
                      key={`gif-${idx}-${gif.id}`}
                      onClick={() => setSelectedGifInModal(gif)}
                      className={`cursor-pointer overflow-hidden rounded-lg border ${
                        selectedGifInModal?.id === gif.id
                          ? 'border-blue-500'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="relative h-24 w-full bg-black">
                        <img
                          src={url}
                          alt={gif.content_description || `GIF ${idx + 1}`}
                          className="w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const container = e.currentTarget.closest('.gif-container');
                            if (container) container.remove();
                            const fallback = document.createElement('div');
                            fallback.className = 'gif-fallback';
                            fallback.textContent = '🎬 GIF not available';
                            e.currentTarget.parentNode?.appendChild(fallback);
                          }}
                          onLoad={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                          style={{ opacity: 0, transition: 'opacity 0.3s' }}
                        />
                      </div>
                      {/* <div className="bg-gray-800 p-2 text-center">
                        <div className="truncate text-xs text-gray-300">
                          {gif.content_description || gif.title || `GIF ${idx + 1}`}
                        </div>
                      </div> */}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {selectedGifInModal && (
            <div className="mt-2 rounded-lg border border-blue-500 bg-gray-800 p-2">
              <ComicText size={0.6} color="#fff" className="mb-1 text-center">
                Selected GIF:
              </ComicText>
              <div className="flex justify-center rounded bg-black p-1">
                <img
                  src={getGifUrl(selectedGifInModal)}
                  alt="Selected GIF"
                  className="h-24 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/150?text=GIF+Error';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <header
        ref={headerRef}
        className="optacity-0 mb-5 flex w-full max-w-4xl items-center justify-between"
      >
        <button
          onClick={handleBackClick}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 max-sm:mt-[15px] md:pr-12 lg:pr-20">
          <div
            ref={titleRef}
            className="translate-y-4 transform opacity-0 transition-all duration-500 max-sm:mt-[15px]"
          >
            <ComicText size={1.2} color={colors.primary}>
              Create GIF Enigma
            </ComicText>
          </div>
        </div>
      </header>

      <main ref={mainContentRef} className="optacity-0 flex flex-1 flex-col items-center px-4">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center">
          {/* Row 1: Category and Word/Phrase toggle */}
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <span className="text-base">
                {currentCategory === 'Movies'
                  ? '🎬'
                  : currentCategory === 'Gaming'
                    ? '🎮'
                    : currentCategory === 'Books'
                      ? '📚'
                      : '🌐'}
              </span>
              <ComicText size={0.6} color={colors.textSecondary}>
                Category: <span style={{ fontWeight: 'bold' }}>{currentCategory}</span>
              </ComicText>
            </div>
            <div className="group relative">
              <div className={disableSecretChange ? 'pointer-events-none opacity-60' : ''}>
                <InputTypeToggle />
              </div>
              {disableSecretChange && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  Clear GIFs to change word/phrase
                </div>
              )}
            </div>
          </div>

           <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2">
             <div className="secret-word-container">
               {secretInput ? (
                 <ComicText size={0.7} color={colors.primary}>
                   <span className="inline-block">
                     Secret {inputType === 'word' ? 'Word' : 'Phrase'}:
                   </span>{' '}
                   <span 
                     className={`secret-word-value transition-all duration-300 ${categoryColor}`}
                     style={{ fontWeight: 'bold' }}
                   >
                     {secretInput.toUpperCase()}
                   </span>
                 </ComicText>
               ) : (
                 <ComicText size={0.6} color={colors.textSecondary}>
                   {isLoadingRecommendations ? 'Loading recommendations...' : 'No recommendations available'}
                 </ComicText>
               )}
             </div>
           </div>
          <div className="group items-left relative justify-center">
            <button
              onClick={getNextRecommendation}
              disabled={disableSecretChange}
              className={`rounded-full px-3 py-1 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                disableSecretChange ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              style={{ backgroundColor: colors.secondary }}
            >
              <ComicText size={0.6} color="#fff">
                Try a different one
              </ComicText>
            </button>
            {disableSecretChange && (
              <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                Clear GIFs to pick another word/phrase
              </div>
            )}
          </div>

          {renderGifGrid()}

          {showSuccessModal && (
            <div className="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm transition-all duration-300">
              <div className="animate-bounce-slow rounded-xl bg-gray-800 p-6 shadow-lg">
                <div className="mb-4 text-4xl">🎉</div>
                <ComicText size={1} color={colors.primary} className="mb-2 text-center">
                  Game Created Successfully!
                </ComicText>
                <ComicText size={0.7} color="white" className="mb-2 text-center">
                  Your GIF Enigma is ready to play!
                </ComicText>
                
                {/* XP Bonus Display */}
                <div className="mt-6 mb-4 flex items-center justify-center">
                  <div className="animate-pulse rounded-lg border-2 border-yellow-400 bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">✨</span>
                      <div className="text-center">
                        <ComicText size={0.5} color="white">
                          Creation Bonus
                        </ComicText>
                        <div className="flex items-center justify-center gap-0.5">
                          <ComicText size={1} color="white">
                            +20
                          </ComicText>
                          <ComicText size={0.6} color="white">
                            XP
                          </ComicText>
                        </div>
                      </div>
                      <span className="text-lg">✨</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);

                      if (headerRef.current) {
                        transitions.fadeOut(headerRef.current, { duration: 300 });
                      }
                      if (mainContentRef.current) {
                        transitions.fadeOut(mainContentRef.current, { duration: 300 });
                      }

                      setTimeout(() => {
                        onNavigate('landing');
                      }, 400);
                    }}
                    className="cursor-pointer rounded-xl px-4 py-2 transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <ComicText size={0.7} color="white">
                      Back to Home
                    </ComicText>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <button
              ref={submitButtonRef}
              onClick={submitGame}
              disabled={selectedGifs.filter((g) => g !== null).length !== 4}
              className={`cursor-pointer rounded-xl border-none px-4 py-2 transition-all duration-300 ${
                selectedGifs.filter((g) => g !== null).length !== 4
                  ? 'bg-gray-500 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'bg-[#FF4500] hover:-translate-y-1 hover:scale-105 hover:shadow-lg active:scale-95'
              }`}
              style={{
                backgroundColor:
                  selectedGifs.filter((g) => g !== null).length === 4 ? colors.primary : '#6B7280',
              }}
            >
              <ComicText size={0.8} color="white">
                {isCreating ? '🔄 Creating...' : '🎮 Create GIF Enigma'}
              </ComicText>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
