import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { Modal } from '../components/Modal';
import { CategoryType } from './CategoryPage';
import { NavigationProps, Page } from '../lib/types';
import * as transitions from '../../src/utils/transitions';

// Refactored: Import API functions instead of direct fetch() calls
import {
  fetchPreGeneratedItems,
  fetchGeminiSynonyms,
  getGeminiRecommendations,
  searchGiphyGifs,
  batchSearchGiphyGifs,
  checkCreationLimit,
  saveGame,
} from '../lib/api';

export interface GiphyGifResult {
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

interface PreGeneratedItem {
  word: string;
  synonyms: string[][];
}

const getGifUrl = (gif: GiphyGifResult | null): string => {
  const url = gif?.url || '';
  // Validate URL format
  if (!url || !url.startsWith('https://')) {
    return '';
  }
  return url;
};

export interface CreatePageProps extends NavigationProps {
  context?: any;
  category?: CategoryType;
  onNavigate: (page: Page) => void;
}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate, category = 'Viral Vibes' }) => {
  const [inputType, setInputType] = useState<'word' | 'phrase'>('word');
  const [currentCategory, setCurrentCategory] = useState<CategoryType>(category);

  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [currentRecIndex, setCurrentRecIndex] = useState<number>(0);
  const [secretInput, setSecretInput] = useState<string>('');
  const [synonyms, setSynonyms] = useState<string[][]>([]);
  // @ts-ignore - Used for loading display logic
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState<boolean>(true);
  // @ts-ignore - Used for loading display logic
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(true);

  // Cache for recommendations to avoid repeated API calls
  const recommendationsCache = useRef<{ [key: string]: string[] }>({});
  const synonymsCache = useRef<{ [key: string]: string[][] }>({});
  const currentWordRef = useRef<string>('');
  const synonymTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const activeFetchRef = useRef<string | null>(null);
  const lastCategoryRef = useRef<CategoryType | null>(null);

  // GIF states
  // @ts-ignore
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<GiphyGifResult[]>([]);
  const [brokenGifIds, setBrokenGifIds] = useState<Set<string>>(new Set());
  const [selectedGifs, setSelectedGifs] = useState<(GiphyGifResult | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);
  const [selectedGifInModal, setSelectedGifInModal] = useState<GiphyGifResult | null>(null);
  const [currentModalSynonym, setCurrentModalSynonym] = useState<string>('');

  const gifCache = useRef<{ [query: string]: GiphyGifResult[] }>({});
  const isBatchFetching = useRef<boolean>(false);
  const currentCachedWord = useRef<string>('');
  const currentSearchTermRef = useRef<string>('');
  const batchFetchingSynonyms = useRef<Set<string>>(new Set());
  const pendingDisplaySynonym = useRef<string | null>(null);
  const searchRetryCount = useRef<number>(0);

  // UI states
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // @ts-ignore
  const [message, setMessage] = useState<string>('');
  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<number>(0); // 0, 1, 2 for progress steps
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCacheChecking, setIsCacheChecking] = useState<boolean>(false);
  const [isWaitingForResults, setIsWaitingForResults] = useState<boolean>(false);
  const [isPageLoaded, setIsPageLoaded] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [bonusAwarded, setBonusAwarded] = useState<boolean>(true);
  const [isQuickCreate, setIsQuickCreate] = useState<boolean>(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isBatchPreFetching, setIsBatchPreFetching] = useState<boolean>(false);
  const [timeUntilReset, setTimeUntilReset] = useState<number>(0); // milliseconds until reset
  const [isAtLimit, setIsAtLimit] = useState<boolean>(false); // Track if user is at creation limit

  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const gifGridRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const cacheCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const cacheRetryIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCacheCheckingRef = React.useRef<boolean>(false);
  const searchStartTimeRef = React.useRef<number | null>(null);
  const progressAnimationRef = React.useRef<number | null>(null);
  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

  // Check creation limit on page load
  useEffect(() => {
    const checkLimitOnLoad = async () => {
      try {
        const limitData = await checkCreationLimit();

        if (limitData.success === true && limitData.canCreate === false) {
          let timeRemaining = 0;
          if (limitData.timeRemainingMs) {
            timeRemaining = limitData.timeRemainingMs;
          } else if (limitData.resetTime) {
            const now = Date.now();
            const resetTime = new Date(limitData.resetTime).getTime();
            timeRemaining = Math.max(0, resetTime - now);
          }
          setIsAtLimit(true);
          setTimeUntilReset(timeRemaining);
        } else {
          setIsAtLimit(false);
          setTimeUntilReset(0);
        }
      } catch (error) {
        setIsAtLimit(false);
      }
    };

    checkLimitOnLoad();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (timeUntilReset <= 0) {
      setIsAtLimit(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeUntilReset((prev) => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          setIsAtLimit(false);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeUntilReset]);

  // Format time remaining helper
  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format as HHhr MMm SSs with zero-padding
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    return `${hoursStr}hr ${minutesStr}m ${secondsStr}s`;
  };

  // Safety: Clear loading state if GIFs are ready but modal is stuck loading
  useEffect(() => {
    if (isSearching && gifs.length > 0) {
      // GIFs are loaded but loading state is still active - clear it
      setIsSearching(false);
      setLoadingStage(0);
      setIsWaitingForResults(false);
    }
  }, [gifs, isSearching]);

  // Retry cache check while modal is open and still loading
  useEffect(() => {
    // Only run if modal is open, we're waiting for results, and no GIFs yet
    if (!showSearchInput || gifs.length > 0 || !isWaitingForResults) {
      if (cacheRetryIntervalRef.current) {
        clearInterval(cacheRetryIntervalRef.current);
        cacheRetryIntervalRef.current = null;
      }
      return;
    }

    const currentTerm = currentSearchTermRef.current;
    if (!currentTerm) return;

    // Retry cache check every 2 seconds while waiting
    cacheRetryIntervalRef.current = setInterval(() => {
      const term = currentSearchTermRef.current;
      if (!term || gifs.length > 0 || !isWaitingForResults) {
        if (cacheRetryIntervalRef.current) {
          clearInterval(cacheRetryIntervalRef.current);
          cacheRetryIntervalRef.current = null;
        }
        return;
      }

      // Check local cache first
      if (gifCache.current[term] && gifCache.current[term].length > 0) {
        setGifs(gifCache.current[term]);
        setIsSearching(false);
        setIsWaitingForResults(false);
        pendingDisplaySynonym.current = null;
        if (cacheRetryIntervalRef.current) {
          clearInterval(cacheRetryIntervalRef.current);
          cacheRetryIntervalRef.current = null;
        }
        return;
      }

      window.parent.postMessage({ type: 'CHECK_GIPHY_CACHE', data: { query: term } }, '*');
    }, 2000);

    return () => {
      if (cacheRetryIntervalRef.current) {
        clearInterval(cacheRetryIntervalRef.current);
        cacheRetryIntervalRef.current = null;
      }
    };
  }, [showSearchInput, gifs.length, isWaitingForResults]);

  // Progress bar that fills smoothly and completes when GIFs load
  useEffect(() => {
    if (!isSearching) {
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
      if (gifs.length > 0 || searchStartTimeRef.current === null) {
        setLoadingStage(0);
        searchStartTimeRef.current = null;
      }
      return;
    }

    // Starting a new search
    if (searchStartTimeRef.current === null) {
      searchStartTimeRef.current = performance.now();
      setLoadingStage(0.1);
    }

    const animate = (currentTime: number) => {
      if (searchStartTimeRef.current === null) return;

      const elapsed = currentTime - searchStartTimeRef.current;
      const timeScale = isBatchPreFetching ? 2500 : 5000;
      const progress = Math.min(
        95,
        80 * (1 - Math.exp(-elapsed / timeScale)) + 15 * (elapsed / (timeScale * 2))
      );
      setLoadingStage(Math.max(0.1, (progress / 100) * 3));

      if (progress < 95 && isSearching) {
        progressAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    progressAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, [isSearching, isBatchPreFetching, gifs.length]);

  useEffect(() => {
    if (category && category !== lastCategoryRef.current) {
      lastCategoryRef.current = category;
      if (currentCategory !== category) {
        setCurrentCategory(category);
      }
    }
  }, [category, currentCategory]);

  // Refactored: Main data fetching effect - uses fetch() instead of postMessage
  useEffect(() => {
    const cacheKey = `${currentCategory}-${inputType}`;

    if (activeFetchRef.current === cacheKey) {
      return;
    }

    // Clear any pending synonym timeouts
    Object.values(synonymTimeoutRef.current).forEach((timeout) => clearTimeout(timeout));
    synonymTimeoutRef.current = {};

    // Priority 1: Check in-memory cache
    if (recommendationsCache.current[cacheKey]) {
      const cachedData = recommendationsCache.current[cacheKey];
      const firstWord = cachedData[0];

      if (synonymsCache.current[firstWord]) {
        // Both words and synonyms cached
        setRecommendations(cachedData);
        setCurrentRecIndex(0);
        currentWordRef.current = firstWord;
        setSecretInput(firstWord);
        setIsLoadingRecommendations(false);
        setSynonyms(synonymsCache.current[firstWord]);
        setIsLoadingSynonyms(false);
        if (activeFetchRef.current === cacheKey || activeFetchRef.current === null) {
          activeFetchRef.current = null;
        }
        return;
      } else {
        // Words cached but synonyms need fetching
        setRecommendations(cachedData);
        setCurrentRecIndex(0);
        currentWordRef.current = firstWord;
        setSecretInput(firstWord);
        setIsLoadingRecommendations(false);
        setIsLoadingSynonyms(true);
        setSynonyms([]);
        return;
      }
    }

    // Priority 2: Cache miss - fetch from pre-generated data
    // Fetch silently without showing loading states initially
    async function loadPreGeneratedItems() {
      activeFetchRef.current = cacheKey;

      try {
        const data = await fetchPreGeneratedItems({
          category: currentCategory,
          inputType,
          count: 20,
        });

        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          const words = data.items.map((item: PreGeneratedItem) => item.word);

          recommendationsCache.current[cacheKey] = words;
          data.items.forEach((item: PreGeneratedItem) => {
            synonymsCache.current[item.word] = item.synonyms;
          });

          const firstWord = words[0];
          activeFetchRef.current = null;
          setRecommendations(words);
          setCurrentRecIndex(0);
          currentWordRef.current = firstWord;
          setSecretInput(firstWord);
          setIsLoadingRecommendations(false);
          setSynonyms(synonymsCache.current[firstWord]);
          setIsLoadingSynonyms(false);
        } else {
          setIsLoadingSynonyms(true);
          setIsLoadingRecommendations(true);
          setSynonyms([]);
          setSecretInput('');

          try {
            const geminiResponse = await getGeminiRecommendations(currentCategory, inputType, 20);
            if (
              geminiResponse.success &&
              geminiResponse.recommendations &&
              geminiResponse.recommendations.length > 0
            ) {
              const words = geminiResponse.recommendations;
              recommendationsCache.current[cacheKey] = words;
              const firstWord = words[0];
              activeFetchRef.current = null;
              setRecommendations(words);
              setCurrentRecIndex(0);
              currentWordRef.current = firstWord;
              setSecretInput(firstWord);
              setIsLoadingRecommendations(false);
              fetchSynonyms(firstWord);
            } else {
              const fallbackData = getFallbackRecommendations();
              recommendationsCache.current[cacheKey] = fallbackData;
              activeFetchRef.current = null;
              setRecommendations(fallbackData);
              setCurrentRecIndex(0);
              currentWordRef.current = fallbackData[0];
              setSecretInput(fallbackData[0]);
              setIsLoadingRecommendations(false);
              fetchSynonyms(fallbackData[0]);
            }
          } catch (apiError) {
            const fallbackData = getFallbackRecommendations();
            recommendationsCache.current[cacheKey] = fallbackData;
            activeFetchRef.current = null;
            setRecommendations(fallbackData);
            setCurrentRecIndex(0);
            currentWordRef.current = fallbackData[0];
            setSecretInput(fallbackData[0]);
            setIsLoadingRecommendations(false);
            fetchSynonyms(fallbackData[0]);
          }
        }
      } catch (error) {
        try {
          const geminiResponse = await getGeminiRecommendations(currentCategory, inputType, 20);
          if (
            geminiResponse.success &&
            geminiResponse.recommendations &&
            geminiResponse.recommendations.length > 0
          ) {
            const words = geminiResponse.recommendations;
            recommendationsCache.current[cacheKey] = words;
            const firstWord = words[0];
            activeFetchRef.current = null;
            setRecommendations(words);
            setCurrentRecIndex(0);
            currentWordRef.current = firstWord;
            setSecretInput(firstWord);
            setIsLoadingRecommendations(false);
            fetchSynonyms(firstWord);
          } else {
            const fallbackData = getFallbackRecommendations();
            recommendationsCache.current[cacheKey] = fallbackData;
            activeFetchRef.current = null;
            setRecommendations(fallbackData);
            setCurrentRecIndex(0);
            currentWordRef.current = fallbackData[0];
            setSecretInput(fallbackData[0]);
            setIsLoadingRecommendations(false);
            fetchSynonyms(fallbackData[0]);
          }
        } catch (apiError) {
          const fallbackData = getFallbackRecommendations();
          recommendationsCache.current[cacheKey] = fallbackData;
          activeFetchRef.current = null;
          setRecommendations(fallbackData);
          setCurrentRecIndex(0);
          currentWordRef.current = fallbackData[0];
          setSecretInput(fallbackData[0]);
          setIsLoadingRecommendations(false);
          fetchSynonyms(fallbackData[0]);
        }
      }
    }

    loadPreGeneratedItems();
  }, [currentCategory, inputType]);

  const getFallbackRecommendations = () => {
    const fallbacks = {
      'Viral Vibes': {
        word: [
          'RICKROLL',
          'CRINGE',
          'UNHINGED',
          'AWKWARD',
          'HYPE',
          'SHOCKED',
          'SALTY',
          'FLEXING',
          'VIBES',
          'ICONIC',
        ],
        phrase: [
          'MIC DROP',
          'SIDE EYE',
          'PLOT TWIST',
          'GLOW UP',
          'MAIN CHARACTER',
          'VIBE CHECK',
          'FACE PALM',
          'MIND BLOWN',
          'EPIC FAIL',
          'HOT TAKE',
        ],
      },
      'Cinematic Feels': {
        word: [
          'STARWARS',
          'TITANIC',
          'AVENGERS',
          'BATMAN',
          'SPIDERMAN',
          'FROZEN',
          'TOYSTORY',
          'PIRATES',
          'WIZARD',
          'GHOSTBUSTERS',
        ],
        phrase: [
          'MAY THE FORCE BE WITH YOU',
          'I AM YOUR FATHER',
          'TO INFINITY AND BEYOND',
          'HERE IS JOHNNY',
          'I WILL BE BACK',
          'SHOW ME THE MONEY',
          'ELEMENTARY MY DEAR WATSON',
          'LIFE IS LIKE A BOX OF CHOCOLATES',
          'I AM SPARTACUS',
          'HOUSTON WE HAVE A PROBLEM',
        ],
      },
      'Gaming Moments': {
        word: [
          'POKEMON',
          'MARIO',
          'SONIC',
          'ZELDA',
          'FORTNITE',
          'MINECRAFT',
          'POKEMON',
          'PACMAN',
          'TETRIS',
          'DONKEYKONG',
        ],
        phrase: [
          'GAME OVER',
          'LEVEL UP',
          'NEW HIGH SCORE',
          'PLAYER ONE READY',
          'CONTINUE GAME',
          'SAVE GAME',
          'LOAD GAME',
          'PAUSE GAME',
          'RESUME GAME',
          'QUIT GAME',
        ],
      },
      'Story Experiences': {
        word: [
          'HARRY',
          'POTTER',
          'SHERLOCK',
          'HOLMES',
          'DRACULA',
          'FRANKENSTEIN',
          'ALICE',
          'WONDERLAND',
          'ROBINHOOD',
          'MULAN',
        ],
        phrase: [
          'ONCE UPON A TIME',
          'THE END',
          'CHAPTER ONE',
          'TO BE CONTINUED',
          'THE ADVENTURE BEGINS',
          'THE MYSTERY DEEPENS',
          'THE FINAL CHAPTER',
          'THE LEGEND LIVES ON',
          'THE STORY CONTINUES',
          'THE TALE IS TOLD',
        ],
      },
    };

    const categoryData = fallbacks[currentCategory] || fallbacks['Viral Vibes'];
    return categoryData[inputType] || categoryData['word'];
  };

  // Refactored: Fetch synonyms using API function
  const fetchSynonyms = async (word: string) => {
    // Check cache first
    if (synonymsCache.current[word]) {
      setSynonyms(synonymsCache.current[word]);
      setIsLoadingSynonyms(false);
      return;
    }

    // Clear any existing timeout for this word
    if (synonymTimeoutRef.current[word]) {
      clearTimeout(synonymTimeoutRef.current[word]);
      delete synonymTimeoutRef.current[word];
    }

    // Show loading state immediately
    setSynonyms([]);
    setIsLoadingSynonyms(true);

    // Refactored: Use API function
    try {
      const data = await fetchGeminiSynonyms(word);

      if (data.success && Array.isArray(data.synonyms) && data.synonyms.length > 0) {
        synonymsCache.current[word] = data.synonyms;

        if (word === currentWordRef.current) {
          setSynonyms(data.synonyms);
          setIsLoadingSynonyms(false);
        }
      } else {
        setIsLoadingSynonyms(false);
      }
    } catch (error) {
      setIsLoadingSynonyms(false);
    }
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
      const nextWord = recommendations[nextIndex];
      setCurrentRecIndex(nextIndex);

      // Clear any pending synonym timeout for the previous word
      Object.values(synonymTimeoutRef.current).forEach((timeout) => clearTimeout(timeout));
      synonymTimeoutRef.current = {};

      currentWordRef.current = nextWord;
      setSecretInput(nextWord);

      gifCache.current = {};
      isBatchFetching.current = false;
      batchFetchingSynonyms.current.clear();
      pendingDisplaySynonym.current = null;
      currentCachedWord.current = nextWord;

      // Reset loading state from previous word
      setIsSearching(false);
      setLoadingStage(0);
      setGifs([]);

      // Check if synonyms are already cached for instant update
      if (synonymsCache.current[nextWord]) {
        setSynonyms(synonymsCache.current[nextWord]);
        setIsLoadingSynonyms(false);
      } else {
        // Show loading state and fetch synonyms
        setSynonyms([]);
        setIsLoadingSynonyms(true);
        fetchSynonyms(nextWord);
      }

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

  // Refactored: Initialization effect - NO postMessage event listeners
  useEffect(() => {
    setIsPageLoaded(true);

    // Apply page animations
    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 150,
        delay: 0,
        direction: 'up',
      });
    }

    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 150,
        delay: 0,
        direction: 'up',
      });
    }

    if (headerRef.current) {
      transitions.fadeIn(headerRef.current, {
        duration: 150,
        direction: 'up',
        distance: 'sm',
      });
    }

    if (backButtonRef.current) {
      transitions.animateElement(backButtonRef.current, {
        duration: 150,
        delay: 0,
        direction: 'left',
      });
    }

    if (mainContentRef.current) {
      transitions.animateElement(mainContentRef.current, {
        duration: 150,
        delay: 0,
        direction: 'up',
      });
    }

    if (gifGridRef.current) {
      transitions.animateElement(gifGridRef.current, {
        duration: 150,
        delay: 0,
        direction: 'up',
      });
    }

    if (submitButtonRef.current) {
      transitions.animateElement(submitButtonRef.current, {
        duration: 150,
        delay: 0,
        direction: 'up',
      });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cacheCheckTimeoutRef.current) {
        clearTimeout(cacheCheckTimeoutRef.current);
      }
      if (cacheRetryIntervalRef.current) {
        clearInterval(cacheRetryIntervalRef.current);
      }
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
      // Clear all synonym timeouts
      Object.values(synonymTimeoutRef.current).forEach((timeout) => clearTimeout(timeout));
      synonymTimeoutRef.current = {};
      searchStartTimeRef.current = null;
    };
  }, []);

  // Refactored: Search GIFs function - uses API function
  const searchGifs = async (term: string) => {
    if (!term) return;

    setSelectedGifInModal(null);
    currentSearchTermRef.current = term;
    searchRetryCount.current = 0;

    // Check cache first - if cached, display instantly
    if (gifCache.current[term] && gifCache.current[term].length > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setGifs(gifCache.current[term]);
      setIsSearching(false);
      setLoadingStage(0);
      setIsWaitingForResults(false);
      setIsBatchPreFetching(false);
      return;
    }

    setGifs([]);
    setIsSearching(true);
    setIsWaitingForResults(true);
    pendingDisplaySynonym.current = term;

    // Refactored: Batch pre-fetch if synonyms available
    if (!isBatchFetching.current && synonyms.length > 0) {
      const allSynonyms = synonyms.map((group) => group[0]).filter(Boolean);
      if (allSynonyms.length > 0) {
        isBatchFetching.current = true;
        setIsBatchPreFetching(true);
        batchFetchingSynonyms.current.clear();
        allSynonyms.forEach((synonym) => {
          batchFetchingSynonyms.current.add(synonym);
        });

        // Refactored: Use API function for batch search
        try {
          const data = await batchSearchGiphyGifs(allSynonyms, 10);

          if (data.success && data.results) {
            Object.keys(data.results).forEach((query) => {
              const gifsForQuery = data.results![query];
              if (gifsForQuery && gifsForQuery.length > 0) {
                gifCache.current[query] = gifsForQuery;
              }
              batchFetchingSynonyms.current.delete(query);
            });

            // ✅ Check if the requested term is now in cache
            if (gifCache.current[term] && gifCache.current[term].length > 0) {
              setGifs(gifCache.current[term]);
              setIsSearching(false);
              setLoadingStage(0);
              setIsWaitingForResults(false);
              setIsBatchPreFetching(false);
              isBatchFetching.current = false;
              return;
            }
          }
        } catch (error) {
          // handle error
        } finally {
          isBatchFetching.current = false;
          setIsBatchPreFetching(false);
        }
      }
    }

    pendingDisplaySynonym.current = term;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Refactored: Direct search using API function (fallback if not in batch cache)
    try {
      const data = await searchGiphyGifs(term, 10);

      if (data.success && Array.isArray(data.results)) {
        if (data.results.length > 0) {
          searchRetryCount.current = 0;
          gifCache.current[term] = data.results;

          if (currentSearchTermRef.current === term) {
            setGifs(data.results);
            setIsSearching(false);
            setLoadingStage(0);
            setIsWaitingForResults(false);
          }
        } else {
          setGifs([]);
          setIsSearching(false);
          setLoadingStage(0);
          setIsWaitingForResults(false);
        }
      }
    } catch (error) {
      setGifs([]);
      setIsSearching(false);
      setLoadingStage(0);
      setIsWaitingForResults(false);
    }
  };

  const handleBackClick = () => {
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 200 });
    }
    if (mainContentRef.current) {
      transitions.fadeOut(mainContentRef.current, { duration: 200, delay: 50 });
    }
    setTimeout(() => {
      onNavigate('category');
    }, 300);
  };

  const selectGifForSlot = (gif: GiphyGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      const gifUrl = getGifUrl(gif);
      if (!gifUrl) {
        return;
      }
      const cleanGif = JSON.parse(JSON.stringify(gif));
      const newSelectedGifs = [...selectedGifs];
      newSelectedGifs[selectedGifIndex] = cleanGif;
      setSelectedGifs(newSelectedGifs);

      setShowSearchInput(false);
      setSelectedGifInModal(null);

      setTimeout(() => {
        setGifs([]);
      }, 300);
    }
  };

  const removeGifFromSlot = (index: number) => {
    const newSelectedGifs = [...selectedGifs];
    newSelectedGifs[index] = null;
    setSelectedGifs(newSelectedGifs);
  };

  // Refactored: Quick Create function - uses API functions
  const handleQuickCreate = async () => {
    if (!secretInput) return;
    if (synonyms.length < 4) return;

    if (isAtLimit && timeUntilReset > 0) {
      setBonusAwarded(false);
      setIsQuickCreate(false);
      setShowSuccessModal(true);
      return;
    }

    try {
      let limitData;
      try {
        limitData = await checkCreationLimit();
      } catch (limitError) {
        limitData = { success: false, canCreate: true };
      }

      if (limitData.success === true && limitData.canCreate === false) {
        let timeRemaining = 0;
        if (limitData.timeRemainingMs) {
          timeRemaining = limitData.timeRemainingMs;
        } else if (limitData.resetTime) {
          const now = Date.now();
          const resetTime = new Date(limitData.resetTime).getTime();
          timeRemaining = Math.max(0, resetTime - now);
        }
        setIsAtLimit(true);
        setTimeUntilReset(timeRemaining);

        setBonusAwarded(false);
        setIsQuickCreate(false);
        setShowSuccessModal(true);
        return;
      }

      // Show modal immediately without loading state
      setIsQuickCreate(true);
      setBonusAwarded(true);
      setCreationError(null);
      setShowSuccessModal(true);

      const synonymsToFetch = synonyms
        .slice(0, 4)
        .map((group) => group[0])
        .filter(Boolean);
      if (synonymsToFetch.length < 4) {
        setBonusAwarded(false);
        setCreationError('Not enough synonyms available. Please try a different word.');
        return;
      }

      const needsFetching = synonymsToFetch.filter(
        (synonym) => !gifCache.current[synonym] || gifCache.current[synonym].length === 0
      );

      // Refactored: Batch fetch missing GIFs using API function
      if (needsFetching.length > 0) {
        const data = await batchSearchGiphyGifs(needsFetching, 10);

        if (data.success && data.results) {
          Object.keys(data.results).forEach((query) => {
            const gifsForQuery = data.results![query];
            if (gifsForQuery && gifsForQuery.length > 0) {
              gifCache.current[query] = gifsForQuery;
            }
          });
        }
      }

      // Collect GIF data from cache
      const autoGifUrls: string[] = [];
      const autoGifDescriptions: string[] = [];
      const autoSearchTerms: string[] = [];

      for (const synonym of synonymsToFetch) {
        const gifResults = gifCache.current[synonym];

        if (gifResults && gifResults.length > 0) {
          const gif = gifResults[0];
          const gifUrl = getGifUrl(gif);

          if (gifUrl) {
            autoGifUrls.push(gifUrl);
            autoGifDescriptions.push(gif.content_description || gif.title || synonym);
            autoSearchTerms.push(synonym);
          }
        }
      }

      if (autoGifUrls.length < 4) {
        setBonusAwarded(false);
        setCreationError('Failed to fetch enough GIFs. Please try again.');
        return;
      }

      // Create masked word
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
          ? 'Can you decode the word from this GIF?'
          : 'Can you decode the phrase from this GIF?';

      const gameData = {
        word: secretInput,
        category: currentCategory,
        maskedWord,
        questionText,
        gifs: autoGifUrls,
        gifDescriptions: autoGifDescriptions,
        searchTerms: autoSearchTerms,
        inputType,
        postToSubreddit: true,
      };

      // Refactored: Save game using API function
      const saveData = await saveGame(gameData);

      if (saveData.success) {
        setBonusAwarded(saveData.bonusAwarded !== false);
        const limitCheck = await checkCreationLimit();
        if (limitCheck.success === true && limitCheck.canCreate === false) {
          setIsAtLimit(true);
          const timeRemaining = limitCheck.timeRemainingMs || 0;
          setTimeUntilReset(timeRemaining);
        } else {
          setIsAtLimit(false);
        }
      } else {
        const errorMsg = saveData.error || '';
        if (errorMsg.includes('Daily creation limit')) {
          setIsAtLimit(true);
          setBonusAwarded(false);
          setCreationError(null);
        } else {
          setBonusAwarded(false);
          setCreationError(errorMsg || 'Failed to create game. Please try again.');
        }
      }
    } catch (error) {
      setBonusAwarded(false);
      setCreationError('An unexpected error occurred. Please try again.');
    }
  };

  // Refactored: Submit game function - uses API functions
  const submitGame = async () => {
    const validGifs = selectedGifs.filter((gif) => gif !== null);
    if (!secretInput) return;
    if (validGifs.length !== 4) return;

    try {
      // Refactored: Check creation limit using API function
      let limitData;
      try {
        limitData = await checkCreationLimit();
      } catch (limitError) {
        limitData = { success: false, canCreate: true };
      }

      if (limitData.success === true && limitData.canCreate === false) {
        let timeRemaining = 0;
        if (limitData.timeRemainingMs) {
          timeRemaining = limitData.timeRemainingMs;
        } else if (limitData.resetTime) {
          const now = Date.now();
          const resetTime = new Date(limitData.resetTime).getTime();
          timeRemaining = Math.max(0, resetTime - now);
        }
        setIsAtLimit(true);
        setTimeUntilReset(timeRemaining);
        setShowSuccessModal(true);
        return;
      }

      setIsCreating(true);

      // Create masked word
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
          ? 'Can you decode the word from this GIF?'
          : 'Can you decode the phrase from this GIF?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      const gifDescriptions = validGifs.map(
        (gif) => gif.content_description || gif.title || 'No description'
      );

      const searchTerms = synonyms.map((group) => group[0] || '');

      // Refactored: Save game using API function
      const saveData = await saveGame({
        word: secretInput,
        category: currentCategory,
        maskedWord,
        questionText,
        gifs: gifUrls,
        gifDescriptions,
        searchTerms,
        inputType,
        postToSubreddit: true,
      });

      setIsCreating(false);
      if (saveData.success) {
        setBonusAwarded(saveData.bonusAwarded !== false);
        setIsQuickCreate(false);
        setShowSuccessModal(true);
        const limitCheck = await checkCreationLimit();
        if (limitCheck.success === true && limitCheck.canCreate === false) {
          setIsAtLimit(true);
          const timeRemaining = limitCheck.timeRemainingMs || 0;
          setTimeUntilReset(timeRemaining);
        } else {
          setIsAtLimit(false);
        }
      } else {
        // Handle error cases
        const errorMsg = saveData.error || '';
        if (errorMsg.includes('Daily creation limit')) {
          setIsAtLimit(true);
          setBonusAwarded(false);
          setIsQuickCreate(false);
          setShowSuccessModal(true);
        }
      }
    } catch (error) {
      setIsCreating(false);
    }
  };

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';
  const categoryColor = isDarkMode ? 'text-yellow-400' : 'text-black';
  const renderGifGrid = () => (
    <div className="mt-1 mb-2" ref={gifGridRef}>
      <div className="mb-1 flex items-center justify-between">
        <ComicText size={0.8} color={colors.primary}>
          GIF Hints
        </ComicText>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => {
          const gif = selectedGifs[index];
          const defaultSynonym = synonyms[index]?.[0] || '';
          const boxNumber = index + 1;
          const showLoading = synonyms.length < 4 || !defaultSynonym;

          return (
            <div
              key={index}
              className={`${backgroundColor} gif-slot-${index} relative flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-gray-500 transition-all duration-300 sm:h-32 md:h-36`}
              style={{
                border: gif ? 'none' : `3px solid ${colors.secondary}`,
              }}
            >
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
                    className="h-full w-full object-cover transition-opacity duration-200"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!showLoading && defaultSynonym) {
                      if (currentCachedWord.current !== secretInput) {
                        gifCache.current = {};
                        isBatchFetching.current = false;
                        batchFetchingSynonyms.current.clear();
                        pendingDisplaySynonym.current = null;
                        currentCachedWord.current = secretInput;
                      }

                      setLoadingStage(0);
                      setIsSearching(false);
                      setGifs([]);
                      setSelectedGifInModal(null);
                      setBrokenGifIds(new Set());

                      setSelectedGifIndex(index);
                      setCurrentModalSynonym(defaultSynonym);
                      setShowSearchInput(true);
                      setSearchTerm(defaultSynonym);
                      setMessage('');
                      setMessageType('info');
                      searchGifs(defaultSynonym);
                    }
                  }}
                  className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-2 text-center transition-all duration-200 ${
                    showLoading ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'
                  }`}
                >
                  <div className="mb-1 flex-shrink-0 text-2xl transition-transform duration-300 hover:rotate-12">
                    {showLoading ? '⏳' : '➕'}
                  </div>
                  <div className="flex max-h-[3rem] min-h-[2.5rem] flex-1 items-center justify-center overflow-hidden transition-opacity duration-300">
                    <ComicText size={0.6} color={colors.textSecondary}>
                      {showLoading ? (
                        <span className="hint-text transition-opacity duration-300 ease-in-out">
                          Loading synonyms...
                        </span>
                      ) : (
                        <>
                          {defaultSynonym ? (
                            <span className="block px-1 text-center">
                              <span className="inline-block">Synonym:</span>{' '}
                              <span
                                className={`hint-text text-yellow-400 transition-opacity duration-300 ease-in-out ${categoryColor} inline-block max-w-full truncate`}
                              >
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

  const InputTypeToggle = React.memo(
    ({
      type,
      onTypeChange,
      primaryColor,
      textSecondaryColor,
    }: {
      type: 'word' | 'phrase';
      onTypeChange: (type: 'word' | 'phrase') => void;
      primaryColor: string;
      textSecondaryColor: string;
    }) => (
      <div className="flex items-center justify-center">
        <div
          className="relative flex h-10 items-center overflow-hidden rounded-full"
          style={{
            backgroundColor: '#2D3748',
            border: `2px solid ${primaryColor}`,
            width: '160px',
            position: 'relative',
            minHeight: '40px',
          }}
        >
          <div
            className="absolute h-full w-1/2 rounded-full transition-all duration-300 ease-in-out"
            style={{
              backgroundColor: primaryColor,
              left: type === 'word' ? '0' : '50%',
              zIndex: 1,
            }}
          />
          <button
            onClick={() => onTypeChange('word')}
            className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center"
          >
            <ComicText size={0.6} color={type === 'word' ? 'white' : textSecondaryColor}>
              Word
            </ComicText>
          </button>
          <button
            onClick={() => onTypeChange('phrase')}
            className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center"
          >
            <ComicText size={0.6} color={type === 'phrase' ? 'white' : textSecondaryColor}>
              Phrase
            </ComicText>
          </button>
        </div>
      </div>
    )
  );

  return (
    <div
      className={`${backgroundColor} flex min-h-screen flex-col items-center p-2 transition-opacity duration-200 select-none`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      <Modal
        title={
          currentModalSynonym
            ? `Select a GIF for ${currentModalSynonym}`
            : 'Select a GIF of your choice'
        }
        isOpen={showSearchInput}
        onClose={() => {
          transitions.fadeOut(document.querySelector('.modal-content'), {
            duration: 200,
            onComplete: () => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              if (cacheCheckTimeoutRef.current) {
                clearTimeout(cacheCheckTimeoutRef.current);
                cacheCheckTimeoutRef.current = null;
              }
              if (progressAnimationRef.current) {
                cancelAnimationFrame(progressAnimationRef.current);
                progressAnimationRef.current = null;
              }
              isCacheCheckingRef.current = false;
              searchStartTimeRef.current = null;
              setShowSearchInput(false);
              setIsSearching(false);
              setIsCacheChecking(false);
            },
          });
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          if (cacheCheckTimeoutRef.current) {
            clearTimeout(cacheCheckTimeoutRef.current);
            cacheCheckTimeoutRef.current = null;
          }
          if (progressAnimationRef.current) {
            cancelAnimationFrame(progressAnimationRef.current);
            progressAnimationRef.current = null;
          }
          isCacheCheckingRef.current = false;
          searchStartTimeRef.current = null;
          setShowSearchInput(false);
          setIsSearching(false);
          setIsCacheChecking(false);
          setLoadingStage(0);
          setGifs([]);
          setBrokenGifIds(new Set());
          setSelectedGifInModal(null);
          setCurrentModalSynonym('');
        }}
        onConfirm={() => {
          if (selectedGifInModal) {
            selectGifForSlot(selectedGifInModal);
          }
        }}
        confirmDisabled={!selectedGifInModal}
      >
        <div className="flex flex-col gap-4">
          {(isSearching || isCacheChecking) && (
            <div className="flex flex-col items-center justify-center pt-12 pb-8">
              {/* Progress Bar */}
              <div className="w-full max-w-md px-4">
                <div className="relative h-3 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(5, (loadingStage / 3) * 100))}%`,
                      backgroundColor: colors.primary,
                      boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
              </div>

              {/* Loading Text */}
              <div className="mt-4">
                <ComicText size={0.7} color="#60A5FA" className="text-center">
                  {loadingStage < 1 && `🔍 Analyzing your ${inputType}...`}
                  {loadingStage >= 1 && loadingStage < 2 && '🎬 Searching GIF library...'}
                  {loadingStage >= 2 && '✨ Selecting best matches...'}
                </ComicText>
              </div>
            </div>
          )}
          {/* Show loading spinner */}
          {!isSearching && !isCacheChecking && isWaitingForResults && gifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500"></div>
              <ComicText size={0.6} color="#60A5FA" className="mt-3 text-center">
                {isBatchPreFetching ? 'Preparing GIFs...' : 'Loading GIFs...'}
              </ComicText>
            </div>
          )}
          {!isSearching &&
            !isCacheChecking &&
            !isWaitingForResults &&
            gifs.filter((gif) => !brokenGifIds.has(gif.id)).length === 0 &&
            gifs.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <ComicText size={0.6} color="#94A3B8" className="text-center">
                  All GIFs failed to load. Try a different word/phrase.
                </ComicText>
              </div>
            )}
          {!isSearching && !isCacheChecking && !isWaitingForResults && gifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <ComicText size={0.6} color="#94A3B8" className="text-center">
                No GIFs found. Try a different word/phrase.
              </ComicText>
            </div>
          )}
          {gifs.filter((gif) => !brokenGifIds.has(gif.id)).length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900 p-2">
              <div className="grid grid-cols-2 gap-2">
                {gifs
                  .filter((gif) => !brokenGifIds.has(gif.id))
                  .slice(0, 6)
                  .map((gif, idx) => {
                    const url = getGifUrl(gif);
                    if (!url) return null;
                    return (
                      <div
                        key={`gif-${idx}-${gif.id}`}
                        onClick={() => setSelectedGifInModal(gif)}
                        className={`cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                          selectedGifInModal?.id === gif.id
                            ? 'border-blue-500 shadow-lg shadow-blue-500/50'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="relative h-20 w-full bg-black">
                          <img
                            src={url}
                            alt={gif.content_description || `GIF ${idx + 1}`}
                            className="h-full w-full object-contain"
                            onError={(_e) => {
                              setBrokenGifIds((prev) => new Set(prev).add(gif.id));
                              if (selectedGifInModal?.id === gif.id) {
                                setSelectedGifInModal(null);
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {gifs.length > 0 && (
            <div className="mt-2 mb-2 flex justify-center">
              <img
                src="/giphy-attribution-marks/PoweredBy_200px-White_HorizText.png"
                alt="Powered by GIPHY"
                className="h-3 opacity-80"
              />
            </div>
          )}
        </div>
      </Modal>

      <header
        ref={headerRef}
        className="mb-8 flex w-full max-w-4xl translate-y-4 transform items-start justify-between px-3 opacity-0 transition-all duration-200 max-sm:mb-6"
      >
        <button
          ref={backButtonRef}
          onClick={handleBackClick}
          className="flex transform cursor-pointer items-center rounded-full border-none px-4 py-1.5 opacity-0 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg max-sm:px-2 max-sm:py-1"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white max-sm:text-xs">👈</span>
          <ComicText size={0.5} color="white" className="max-sm:text-xs">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 max-sm:pr-0 md:pr-12 lg:pr-20">
          <div
            ref={titleRef}
            className="translate-y-4 transform opacity-0 transition-all duration-200"
          >
            <ComicText
              size={1.2}
              color={colors.primary}
              align="center"
              className="max-sm:text-base"
            >
              Create GIF Enigma
            </ComicText>
          </div>
        </div>
      </header>

      <main ref={mainContentRef} className="optacity-0 flex flex-1 flex-col items-center px-2">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center">
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <span className="text-base">
                {currentCategory === 'Cinematic Feels'
                  ? '🎬'
                  : currentCategory === 'Gaming Moments'
                    ? '🎮'
                    : currentCategory === 'Story Experiences'
                      ? '📚'
                      : currentCategory === 'Viral Vibes'
                        ? '🔥'
                        : '🌐'}
              </span>
              <ComicText size={0.6} color={colors.textSecondary}>
                Category: <span style={{ fontWeight: 'bold' }}>{currentCategory}</span>
              </ComicText>
            </div>
            <div className="group relative">
              <div className={disableSecretChange ? 'pointer-events-none opacity-60' : ''}>
                <InputTypeToggle
                  type={inputType}
                  onTypeChange={setInputType}
                  primaryColor={colors.primary}
                  textSecondaryColor={colors.textSecondary}
                />
              </div>
              {disableSecretChange && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  Clear GIFs to change word/phrase
                </div>
              )}
              {/* Row 1: Category and Word/Phrase toggle */}
            </div>
          </div>

          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="secret-word-container">
              <ComicText size={0.7} color={colors.primary}>
                <span className="inline-block">
                  Secret {inputType === 'word' ? 'Word' : 'Phrase'}:
                </span>{' '}
                {secretInput ? (
                  <span
                    className={`secret-word-value transition-all duration-300 ${categoryColor}`}
                    style={{ fontWeight: 'bold' }}
                  >
                    {secretInput.toUpperCase()}
                  </span>
                ) : (
                  <span style={{ color: colors.textSecondary }}>
                    {isLoadingRecommendations ? 'Loading...' : 'No recommendations available'}
                  </span>
                )}
              </ComicText>
            </div>
          </div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <div className="group relative">
              <button
                onClick={getNextRecommendation}
                disabled={disableSecretChange}
                className={`rounded-full px-2 py-1.5 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                  disableSecretChange ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
                style={{ backgroundColor: colors.secondary }}
              >
                <ComicText size={0.6} color="#fff">
                  🔄 Try a different one
                </ComicText>
              </button>
              {disableSecretChange && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  Clear GIFs to pick another word/phrase
                </div>
              )}
            </div>

            <div className="group relative">
              <button
                onClick={handleQuickCreate}
                disabled={!secretInput || synonyms.length < 4 || isCreating}
                className={`rounded-full px-2 py-1.5 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                  !secretInput || synonyms.length < 4 || isCreating
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                }`}
                style={{ backgroundColor: colors.primary }}
              >
                <ComicText size={0.6} color="#fff">
                  {isCreating ? '⏳ Creating...' : '🚀 Quick Create'}
                </ComicText>
              </button>
              {(!secretInput || synonyms.length < 4) && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  {!secretInput ? 'Select a word/phrase first' : 'Loading synonyms...'}
                </div>
              )}
            </div>
          </div>

          {renderGifGrid()}

          {showSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md transition-all duration-300">
              <div className="animate-bounce-slow w-96 rounded-xl border-2 border-gray-600 bg-gray-800 p-5 shadow-2xl">
                <>
                  <div className="mb-3 flex justify-center text-3xl">
                    {bonusAwarded ? '🎉' : '⚠️'}
                  </div>
                  <ComicText size={1} color={colors.primary} className="mb-2 text-center">
                    {bonusAwarded
                      ? isQuickCreate
                        ? 'Game Creation in Progress!'
                        : 'Game Created Successfully!'
                      : creationError
                        ? 'Creation Failed'
                        : 'Daily Creation Limit Reached'}
                  </ComicText>
                  {bonusAwarded ? (
                    <>
                      <ComicText size={0.6} color="white" className="mb-2 text-center">
                        {isQuickCreate
                          ? 'Your puzzle is being created...'
                          : 'Your puzzle has been posted!'}
                      </ComicText>
                      <ComicText size={0.5} color="#94A3B8" className="mb-2 text-center">
                        Check the subreddit feed {isQuickCreate ? 'in a moment' : 'now'}
                      </ComicText>
                    </>
                  ) : creationError ? (
                    <>
                      <ComicText size={0.6} color="white" className="mb-2 text-center">
                        {creationError}
                      </ComicText>
                    </>
                  ) : (
                    <>
                      <ComicText size={0.6} color="white" className="mb-2 text-center">
                        You've reached the daily limit of 4 puzzles
                      </ComicText>
                      <div className="mb-2 flex justify-center">
                        <ComicText
                          size={0.7}
                          color={colors.primary}
                          className="text-center font-mono font-bold"
                        >
                          You can create new puzzles in {formatTimeRemaining(timeUntilReset)}
                        </ComicText>
                      </div>
                    </>
                  )}
                </>

                {bonusAwarded && (
                  <div className="mt-4 mb-3 flex items-center justify-center">
                    <div className="animate-pulse rounded-lg border-2 border-yellow-400 bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1.5 shadow-lg">
                      <div className="flex items-center gap-1">
                        <span className="text-base">✨</span>
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
                        <span className="text-base">✨</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex justify-center">
                  <button
                    onClick={() => {
                      onNavigate('landing');
                    }}
                    className="cursor-pointer rounded-lg px-4 py-1.5 transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <ComicText size={0.65} color="white">
                      Back to Home
                    </ComicText>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex justify-center">
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
