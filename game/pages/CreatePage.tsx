import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { Modal } from '../components/Modal';
import { CategoryType } from './CategoryPage';
import { NavigationProps, Page } from '../lib/types';
import * as transitions from '../../src/utils/transitions';

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

const getGifUrl = (gif: GiphyGifResult | null): string => {
  return gif?.url || '';
};

export interface CreatePageProps extends NavigationProps {
  context: any;
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
  // @ts-ignore - Used internally for state management, display logic uses synonyms.length
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState<boolean>(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  
  // Cache for recommendations to avoid repeated API calls
  const recommendationsCache = useRef<{ [key: string]: string[] }>({});
  const synonymsCache = useRef<{ [key: string]: string[][] }>({});
  const currentWordRef = useRef<string>('');
  const hasShownDataRef = useRef<{ [key: string]: boolean }>({});
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const synonymTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  // Quick Create batch completion callback
  const batchCompletionCallbackRef = useRef<(() => void) | null>(null);

  // GIF states
  // @ts-ignore
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<GiphyGifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<(GiphyGifResult | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);
  const [selectedGifInModal, setSelectedGifInModal] = useState<GiphyGifResult | null>(null);
  const [currentModalSynonym, setCurrentModalSynonym] = useState<string>('');

  // Frontend memory cache for GIF results per synonym - avoids repeated fetches in current session
  // Clear this frontend cache when word changes for proper display, but Redis cache remains intact.
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
  const [isBatchPreFetching, setIsBatchPreFetching] = useState<boolean>(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const gifGridRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const cacheCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const cacheRetryIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCacheCheckingRef = React.useRef<boolean>(false);
  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

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

      window.parent.postMessage(
        { type: 'CHECK_GIPHY_CACHE', data: { query: term } },
        '*'
      );
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
      setLoadingStage(0);
      return;
    }
    
    // Start at 0.1 immediately so loading shows right away (loadingStage > 0)
    setLoadingStage(0.1);
    
    // Continuous smooth animation using requestAnimationFrame
    let startTime: number | null = null;
    let animationFrameId: number;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;

      const timeScale = isBatchPreFetching ? 2500 : 5000;
      const progress = Math.min(95, 80 * (1 - Math.exp(-elapsed / timeScale)) + 15 * (elapsed / (timeScale * 2)));
      
      setLoadingStage(Math.max(0.1, progress / 100 * 3)); // Convert to 0-3 scale, min 0.1
      
      // Continue animation until GIFs load
      if (progress < 95) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isSearching, isBatchPreFetching]);

  useEffect(() => {
    if (category) {
      setCurrentCategory(category);
    }

    // Clear previous state immediately
    setSynonyms([]);
    setSecretInput('');
    
    // Clear any pending synonym timeouts
    Object.values(synonymTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
    synonymTimeoutRef.current = {};
    
    // Check if we have cached pre-generated data first
    const cacheKey = `${currentCategory}-${inputType}`;
    if (recommendationsCache.current[cacheKey]) {
      const cachedData = recommendationsCache.current[cacheKey];
      const firstWord = cachedData[0];
      
      // Only display if BOTH recommendations AND synonyms are ready
      if (synonymsCache.current[firstWord]) {
        // INSTANT display - everything is pre-generated and cached
        setRecommendations(cachedData);
        setCurrentRecIndex(0);
        currentWordRef.current = firstWord;
        setSecretInput(firstWord);
        setIsLoadingRecommendations(false);
        setSynonyms(synonymsCache.current[firstWord]);
        setIsLoadingSynonyms(false);
      } else {
        // Synonyms not ready - this shouldn't happen with pre-generated data
        setIsLoadingRecommendations(true);
        setIsLoadingSynonyms(true);
        currentWordRef.current = firstWord;
        setSecretInput(firstWord);
        setSynonyms([]);
      }
    } else {
      // No cached data - fetch pre-generated items
      setIsLoadingSynonyms(true);
      setIsLoadingRecommendations(true);
      window.parent.postMessage(
        { 
          type: 'FETCH_PREGENERATED_ITEMS', 
          data: { 
            category: currentCategory, 
            inputType,
            count: 20 
          } 
        },
        '*'
      );
    }
  }, [currentCategory, inputType]);

  const getFallbackRecommendations = () => {
    const fallbacks = {
      'Viral Vibes': {
        word: ['RICKROLL', 'CRINGE', 'UNHINGED', 'AWKWARD', 'HYPE', 'SHOCKED', 'SALTY', 'FLEXING', 'VIBES', 'ICONIC'],
        phrase: ['MIC DROP', 'SIDE EYE', 'PLOT TWIST', 'GLOW UP', 'MAIN CHARACTER', 'VIBE CHECK', 'FACE PALM', 'MIND BLOWN', 'EPIC FAIL', 'HOT TAKE']
      },
      'Cinematic Feels': {
        word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN', 'FROZEN', 'TOYSTORY', 'PIRATES', 'WIZARD', 'GHOSTBUSTERS'],
        phrase: ['MAY THE FORCE BE WITH YOU', 'I AM YOUR FATHER', 'TO INFINITY AND BEYOND', 'HERE IS JOHNNY', 'I WILL BE BACK', 'SHOW ME THE MONEY', 'ELEMENTARY MY DEAR WATSON', 'LIFE IS LIKE A BOX OF CHOCOLATES', 'I AM SPARTACUS', 'HOUSTON WE HAVE A PROBLEM']
      },
      'Gaming Moments': {
        word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE', 'MINECRAFT', 'POKEMON', 'PACMAN', 'TETRIS', 'DONKEYKONG'],
        phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE', 'PLAYER ONE READY', 'CONTINUE GAME', 'SAVE GAME', 'LOAD GAME', 'PAUSE GAME', 'RESUME GAME', 'QUIT GAME']
      },
      'Story Experiences': {
        word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA', 'FRANKENSTEIN', 'ALICE', 'WONDERLAND', 'ROBINHOOD', 'MULAN'],
        phrase: ['ONCE UPON A TIME', 'THE END', 'CHAPTER ONE', 'TO BE CONTINUED', 'THE ADVENTURE BEGINS', 'THE MYSTERY DEEPENS', 'THE FINAL CHAPTER', 'THE LEGEND LIVES ON', 'THE STORY CONTINUES', 'THE TALE IS TOLD']
      }
    };

    const categoryData = fallbacks[currentCategory] || fallbacks['Viral Vibes'];
    return categoryData[inputType] || categoryData['word'];
  };

  const preFetchAllGifs = async (synonymGroups: string[][]) => {
    if (!synonymGroups || synonymGroups.length === 0) return;
    
    const searchTerms = synonymGroups.map(group => group[0]).filter(Boolean);
    if (searchTerms.length === 0) return;
    
    // Check if all are already cached
    const allCached = searchTerms.every(term => gifCache.current[term]?.length > 0);
    if (allCached) {
      return;
    }
    
    // Show loading state for batch pre-fetch
    setIsBatchPreFetching(true);
    setIsSearching(true);
    
    // Request batch fetch for all search terms
    window.parent.postMessage(
      {
        type: 'SEARCH_BATCH_GIPHY_GIFS',
        data: { queries: searchTerms, limit: 16 }
      },
      '*'
    );
  };

  const fetchSynonyms = async (word: string) => {
    // Check cache first
    if (synonymsCache.current[word]) {
      setSynonyms(synonymsCache.current[word]);
      setIsLoadingSynonyms(false);
      // Pre-fetch GIFs for these synonyms
      preFetchAllGifs(synonymsCache.current[word]);
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
    
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_SYNONYMS',
        data: { word },
      },
      '*'
    );
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
      Object.values(synonymTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
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

  useEffect(() => {
    setIsPageLoaded(true);

    // Fetch pre-generated items on mount - NO API calls, instant data
    window.parent.postMessage(
      { 
        type: 'FETCH_PREGENERATED_ITEMS', 
        data: { 
          category: currentCategory, 
          inputType,
          count: 20 
        } 
      },
      '*'
    );

    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 300,
        delay: 100,
        direction: 'up',
      });
    }

    if (headerRef.current) {
      transitions.fadeIn(headerRef.current, {
        duration: 250,
        direction: 'up',
        distance: 'sm',
      });
    }

    if (mainContentRef.current) {
      transitions.animateElement(mainContentRef.current, {
        duration: 300,
        delay: 150,
        direction: 'up',
      });
    }

    if (gifGridRef.current) {
      transitions.animateElement(gifGridRef.current, {
        duration: 350,
        delay: 250,
        direction: 'up',
      });
    }

    if (submitButtonRef.current) {
      transitions.animateElement(submitButtonRef.current, {
        duration: 350,
        delay: 350,
        direction: 'up',
      });
    }
    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;
      
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      }
      if (!msg || typeof msg !== 'object') return;
      
      if (msg.type === 'FETCH_PREGENERATED_ITEMS_RESULT') {
        if (msg.success && Array.isArray(msg.items) && msg.items.length > 0) {
          const cacheKey = `${msg.category}-${msg.inputType}`;
          
          // Extract words and synonyms from pre-generated items
          const words = msg.items.map((item: any) => item.word);
          
          // Populate both caches atomically
          recommendationsCache.current[cacheKey] = words;
          msg.items.forEach((item: any) => {
            synonymsCache.current[item.word] = item.synonyms;
          });
          
          // Display first word and synonyms INSTANTLY - everything is pre-generated
          const firstWord = words[0];
          setRecommendations(words);
          setCurrentRecIndex(0);
          currentWordRef.current = firstWord;
          setSecretInput(firstWord);
          setIsLoadingRecommendations(false);
          setSynonyms(synonymsCache.current[firstWord]);
          setIsLoadingSynonyms(false);
        } else {
          // Use fallback recommendations if pre-generation failed
          const cacheKey = `${currentCategory}-${inputType}`;
          const fallbackData = getFallbackRecommendations();
          recommendationsCache.current[cacheKey] = fallbackData;
          setRecommendations(fallbackData);
          setCurrentRecIndex(0);
          currentWordRef.current = fallbackData[0];
          setSecretInput(fallbackData[0]);
          setIsLoadingRecommendations(false);
          fetchSynonyms(fallbackData[0]);
        }
      }
      
      if (msg.type === 'GET_GEMINI_RECOMMENDATIONS_RESULT') {
        if (msg.success && Array.isArray(msg.result)) {
          const filtered = msg.result.filter((r: string) => r.length >= 5);
          
          // Use the category and inputType from the response to determine the correct cache key
          const responseCategory = msg.category || currentCategory;
          const responseInputType = msg.inputType || inputType;
          const cacheKey = `${responseCategory}-${responseInputType}`;
          
          // Remove from pending requests
          pendingRequestsRef.current.delete(cacheKey);
          
          // Store in cache
          recommendationsCache.current[cacheKey] = filtered;
          
          // Only update UI if this response is for the currently active category and type
          const isCurrentlyActive = responseCategory === currentCategory && responseInputType === inputType;
          
          if (isCurrentlyActive && filtered.length > 0) {
            setIsLoadingRecommendations(false);
            
            // Update UI with API data
            setRecommendations(filtered);
            setCurrentRecIndex(0);
            currentWordRef.current = filtered[0]; // Update ref immediately
            setSecretInput(filtered[0]);
            hasShownDataRef.current[cacheKey] = true; // Mark as shown
            
            // Fetch synonyms for the first word
            fetchSynonyms(filtered[0]);
          }
        } else {
          // Only show fallback if we don't already have data for the current type
          const cacheKey = `${currentCategory}-${inputType}`;
          if (!secretInput && !recommendationsCache.current[cacheKey]) {
            setIsLoadingRecommendations(false);
            // Use fallback recommendations instead of leaving empty
            const fallbackData = getFallbackRecommendations();
            recommendationsCache.current[cacheKey] = fallbackData;
            setRecommendations(fallbackData);
            setCurrentRecIndex(0);
            currentWordRef.current = fallbackData[0];
            setSecretInput(fallbackData[0]);
            fetchSynonyms(fallbackData[0]);
          }
          pendingRequestsRef.current.delete(cacheKey);
        }
      }

      if (msg.type === 'GET_GEMINI_SYNONYMS_RESULT') {
        const wordForCache = msg.word || currentWordRef.current;
        
        // Clear timeout for this word if it exists
        if (wordForCache && synonymTimeoutRef.current[wordForCache]) {
          clearTimeout(synonymTimeoutRef.current[wordForCache]);
          delete synonymTimeoutRef.current[wordForCache];
        }
        
        if (msg.success && Array.isArray(msg.result) && msg.result.length > 0) {
          if (wordForCache) {
            synonymsCache.current[wordForCache] = msg.result;
          }
          // Only update UI if this is for the current word
          if (wordForCache === currentWordRef.current) {
            // Display word AND synonyms together
            const cacheKey = `${currentCategory}-${inputType}`;
            if (recommendationsCache.current[cacheKey]) {
              const cachedData = recommendationsCache.current[cacheKey];
              const wordIndex = cachedData.indexOf(wordForCache);
              if (wordIndex >= 0) {
                setRecommendations(cachedData);
                setCurrentRecIndex(wordIndex);
                setSecretInput(wordForCache);
                setIsLoadingRecommendations(false);
              }
            }
            
            setSynonyms(msg.result);
            setIsLoadingSynonyms(false);
          }
        }
      }

      if (msg.type === 'SEARCH_GIPHY_GIFS_RESULT') {
        const searchedTerm = (msg.query as string) || currentSearchTermRef.current;
        
        // Only clear timeout if this is for the current search
        if (searchedTerm === currentSearchTermRef.current && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (msg.success && Array.isArray(msg.results)) {
          if (msg.results.length > 0) {
            searchRetryCount.current = 0;
            if (searchedTerm) {
              gifCache.current[searchedTerm] = msg.results;
            }
            
            if (searchedTerm === currentSearchTermRef.current) {
              setGifs(msg.results);
              setIsSearching(false);
              setLoadingStage(0);
              setIsWaitingForResults(false);
            }
          } else if (searchedTerm === currentSearchTermRef.current && searchRetryCount.current < 2) {
            searchRetryCount.current++;
            setIsSearching(true);
            setTimeout(() => {
              if (currentSearchTermRef.current === searchedTerm && searchedTerm) {
                window.parent.postMessage(
                  {
                    type: 'SEARCH_GIPHY_GIFS',
                    data: { query: searchedTerm, limit: 6 },
                  },
                  '*'
                );
              }
            }, 3000);
          } else if (searchedTerm === currentSearchTermRef.current) {
            // Max retries reached, show empty state
            searchRetryCount.current = 0;
            setIsSearching(false);
            setLoadingStage(0);
            setIsWaitingForResults(false);
            setGifs([]);
          }
        } else if (searchedTerm === currentSearchTermRef.current && searchRetryCount.current < 2) {
          searchRetryCount.current++;
          setIsSearching(true);
          setTimeout(() => {
            if (currentSearchTermRef.current === searchedTerm && searchedTerm) {
              window.parent.postMessage(
                {
                  type: 'SEARCH_GIPHY_GIFS',
                  data: { query: searchedTerm, limit: 6 },
                },
                '*'
              );
            }
          }, 3000);
        } else if (searchedTerm === currentSearchTermRef.current) {
          // Max retries reached on error, show empty state
          searchRetryCount.current = 0;
          setLoadingStage(0);
          setIsSearching(false);
          setIsWaitingForResults(false);
          setGifs([]);
        }
      }

      if (msg.type === 'CHECK_GIPHY_CACHE_RESULT') {
        const query = msg.query;
        
        isCacheCheckingRef.current = false;
        setIsCacheChecking(false);
        if (cacheCheckTimeoutRef.current) {
          clearTimeout(cacheCheckTimeoutRef.current);
          cacheCheckTimeoutRef.current = null;
        }
        
        // Clear the search timeout since we got a response
        if (timeoutRef.current && currentSearchTermRef.current === query) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (msg.success && msg.cached && Array.isArray(msg.results) && msg.results.length > 0) {
          if (query) {
            gifCache.current[query] = msg.results;
            if (currentSearchTermRef.current === query && pendingDisplaySynonym.current === query) {
              pendingDisplaySynonym.current = null;
              setGifs(msg.results);
              setIsSearching(false);
              setLoadingStage(0);
              setIsWaitingForResults(false);
            }
          }
        } else {
          if (currentSearchTermRef.current === query && pendingDisplaySynonym.current === query) {
            window.parent.postMessage(
              { type: 'SEARCH_GIPHY_GIFS', data: { query: query, limit: 6 } },
              '*'
            );
            timeoutRef.current = setTimeout(() => {
              if (currentSearchTermRef.current === query) {
                setIsSearching(false);
                setIsWaitingForResults(false);
              }
            }, 25000);
          }
        }
      }

      if (msg.type === 'SEARCH_BATCH_GIPHY_GIFS_PARTIAL') {
        if (msg.success && msg.query) {
          const query = msg.query as string;
          const results = (msg.results as GiphyGifResult[]) || [];
          
          // Cache the results
          if (results.length > 0) {
            gifCache.current[query] = results;
          }
          batchFetchingSynonyms.current.delete(query);
          
          // If this is the synonym the user clicked on, display immediately
          const isWaitingForThis = pendingDisplaySynonym.current === query || 
                                   currentSearchTermRef.current === query;
          
          if (isWaitingForThis && results.length > 0) {
            pendingDisplaySynonym.current = null;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setGifs(results);
            setIsSearching(false);
            setLoadingStage(0);
            setIsWaitingForResults(false);
          } else if (pendingDisplaySynonym.current === query && results.length === 0) {
            setIsWaitingForResults(false);
          }
        }
      }

      if (msg.type === 'SEARCH_BATCH_GIPHY_GIFS_RESULT') {
        if (msg.success && msg.results) {
          Object.keys(msg.results).forEach((query) => {
            const gifsForQuery = msg.results![query];
            if (gifsForQuery && gifsForQuery.length > 0) {
              gifCache.current[query] = gifsForQuery;
            }
            batchFetchingSynonyms.current.delete(query);
          });
          
          // Notify Quick Create that batch is complete
          if (batchCompletionCallbackRef.current) {
            batchCompletionCallbackRef.current();
            batchCompletionCallbackRef.current = null;
          }
          
          // Clear batch pre-fetch loading state
          setIsBatchPreFetching(false);
          isBatchFetching.current = false;
          
          // Check if we should display - either pendingDisplaySynonym or currentSearchTerm
          const searchTerm = currentSearchTermRef.current;
          const waiting = pendingDisplaySynonym.current || searchTerm;
          
          if (waiting && gifCache.current[waiting] && gifCache.current[waiting].length > 0) {
            pendingDisplaySynonym.current = null;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setGifs(gifCache.current[waiting]);
            setIsSearching(false);
            setLoadingStage(0);
            setIsWaitingForResults(false);
          } else {
            // Batch complete, clear loading if no specific wait
            setIsSearching(false);
            setLoadingStage(0);
          }
        } else {
          setIsBatchPreFetching(false);
          isBatchFetching.current = false;
          batchFetchingSynonyms.current.clear();
          if (pendingDisplaySynonym.current) {
            const waiting = pendingDisplaySynonym.current;
            pendingDisplaySynonym.current = null;
            window.parent.postMessage(
              { type: 'SEARCH_GIPHY_GIFS', data: { query: waiting, limit: 6 } },
              '*'
            );
          }
        }
        isBatchFetching.current = false;
      }

      if (msg.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);
        if (msg.success && msg.result && msg.result.success) {
          setBonusAwarded(msg.result.bonusAwarded !== false); // Default to true if not specified
          setShowSuccessModal(true);
        } else {
          setShowSuccessModal(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cacheCheckTimeoutRef.current) {
        clearTimeout(cacheCheckTimeoutRef.current);
      }
      if (cacheRetryIntervalRef.current) {
        clearInterval(cacheRetryIntervalRef.current);
      }
      // Clear all synonym timeouts
      Object.values(synonymTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      synonymTimeoutRef.current = {};
    };
  }, []);

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
    
    if (!isBatchFetching.current && synonyms.length > 0) {
      const allSynonyms = synonyms.map((group) => group[0]).filter(Boolean);
      if (allSynonyms.length > 0) {
        isBatchFetching.current = true;
        setIsBatchPreFetching(true);
        batchFetchingSynonyms.current.clear();
        allSynonyms.forEach((synonym) => {
          batchFetchingSynonyms.current.add(synonym);
        });
        
        // Trigger batch fetch in parallel
        window.parent.postMessage(
          {
            type: 'SEARCH_BATCH_GIPHY_GIFS',
            data: { queries: allSynonyms, limit: 6 },
          },
          '*'
        );
      }
    }
    
    pendingDisplaySynonym.current = term;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    window.parent.postMessage(
      { type: 'CHECK_GIPHY_CACHE', data: { query: term } },
      '*'
    );
    
    timeoutRef.current = setTimeout(() => {
      if (currentSearchTermRef.current === term && pendingDisplaySynonym.current === term) {
        window.parent.postMessage(
          { type: 'SEARCH_GIPHY_GIFS', data: { query: term, limit: 6 } },
          '*'
        );
      }
    }, 3000);
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

  const handleQuickCreate = async () => {
    if (!secretInput) {
      return;
    }

    if (synonyms.length < 4) {
      return;
    }

    setIsCreating(true);

    // Check daily limit first
    window.parent.postMessage(
      { type: 'CHECK_CREATION_LIMIT' },
      '*'
    );

    // Wait for limit check response
    const limitCheckPromise = new Promise<boolean>((resolve) => {
      const handleLimitCheck = (event: MessageEvent) => {
        let msg = event.data;
        if (msg?.type === 'devvit-message' && msg.data?.message) {
          msg = msg.data.message;
        }
        
        if (msg?.type === 'CHECK_CREATION_LIMIT_RESULT') {
          window.removeEventListener('message', handleLimitCheck);
          resolve(msg.canCreate === true);
        }
      };
      
      window.addEventListener('message', handleLimitCheck);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleLimitCheck);
        resolve(true); // Allow creation on timeout
      }, 5000);
    });

    const canCreate = await limitCheckPromise;
    
    if (!canCreate) {
      setIsCreating(false);
      setBonusAwarded(false);
      setIsQuickCreate(false);
      setShowSuccessModal(true);
      return;
    }

    setBonusAwarded(true);
    setIsQuickCreate(true);
    setShowSuccessModal(true);

    // Small delay to ensure UI is ready
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      // Collect synonyms (first 4)
      const synonymsToFetch = synonyms.slice(0, 4).map(group => group[0]).filter(Boolean);
      
      if (synonymsToFetch.length < 4) {
        return;
      }

      const needsFetching = synonymsToFetch.filter(synonym => 
        !gifCache.current[synonym] || gifCache.current[synonym].length === 0
      );

      if (needsFetching.length > 0) {
        
        // Create a promise that resolves when batch completes
        const batchCompletePromise = new Promise<void>((resolve) => {
          // Set callback that will be triggered by message handler
          batchCompletionCallbackRef.current = () => {
            resolve();
          };
          
          // Timeout after 25 seconds as fallback
          setTimeout(() => {
            batchCompletionCallbackRef.current = null;
            resolve();
          }, 25000);
        });
        
        // Send batch request
        window.parent.postMessage(
          { type: 'SEARCH_BATCH_GIPHY_GIFS', data: { queries: needsFetching, limit: 6 } },
          '*'
        );
        await batchCompletePromise;
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

      window.parent.postMessage(
        {
          type: 'SAVE_GAME',
          data: gameData,
        },
        '*'
      );
    } catch (error) {
      setIsCreating(false);
    }
  };

  const submitGame = async () => {
    const validGifs = selectedGifs.filter((gif) => gif !== null);
    if (!secretInput) {
      return;
    }
    if (validGifs.length !== 4) {
      return;
    }

    // Check daily limit first
    window.parent.postMessage(
      { type: 'CHECK_CREATION_LIMIT' },
      '*'
    );

    // Wait for limit check response
    const limitCheckPromise = new Promise<boolean>((resolve) => {
      const handleLimitCheck = (event: MessageEvent) => {
        let msg = event.data;
        if (msg?.type === 'devvit-message' && msg.data?.message) {
          msg = msg.data.message;
        }
        
        if (msg?.type === 'CHECK_CREATION_LIMIT_RESULT') {
          window.removeEventListener('message', handleLimitCheck);
          resolve(msg.canCreate === true);
        }
      };
      
      window.addEventListener('message', handleLimitCheck);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleLimitCheck);
        resolve(true); // Allow creation on timeout
      }, 5000);
    });

    const canCreate = await limitCheckPromise;
    
    if (!canCreate) {
      setBonusAwarded(false);
      setIsQuickCreate(false);
      setShowSuccessModal(true);
      return;
    }

    // Set creating state only after limit check passes
    setIsCreating(true);

    // Show success modal immediately for user feedback
    setBonusAwarded(true);
    setIsQuickCreate(false);
    setShowSuccessModal(true);

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
          ? 'Can you decode the word from this GIF?'
          : 'Can you decode the phrase from this GIF?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      const gifDescriptions = validGifs.map((gif) => 
        gif.content_description || gif.title || 'No description'
      );

      const searchTerms = synonyms.map((group) => group[0] || '');

      window.parent.postMessage(
        {
          type: 'SAVE_GAME',
          data: {
            word: secretInput,
            category: currentCategory,
            maskedWord,
            questionText,
            gifs: gifUrls,
            gifDescriptions,
            searchTerms,
            inputType,
          },
        },
        '*'
      );
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
    <div className="mb-4 mt-2" ref={gifGridRef}>
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
          const showLoading = synonyms.length < 4 || !defaultSynonym;

          return (
            <div
              key={index}
              className={`${backgroundColor} gif-slot-${index} relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-500 transition-all duration-300 sm:h-32 sm:w-48 md:h-56 md:w-56 lg:h-60 lg:w-60 xl:h-64 xl:w-64 2xl:h-64 2xl:w-64`}
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
                    className="h-full w-full object-cover transition-opacity duration-500"
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
                      
                      // Reset loading states BEFORE opening modal to prevent flash
                      setLoadingStage(0);
                      setIsSearching(false);
                      setGifs([]);
                      setSelectedGifInModal(null);
                      
                      setSelectedGifIndex(index);
                      setCurrentModalSynonym(defaultSynonym);
                      setShowSearchInput(true);
                      setSearchTerm(defaultSynonym);
                      setMessage('');
                      setMessageType('info');
                      
                      // Fetch clicked synonym's GIFs (will use cache if batch already loaded them)
                      searchGifs(defaultSynonym);
                      // Note: Batch pre-fetch for all synonyms happens when synonyms load, not here
                    }
                  }}
                  className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-2 text-center transition-all duration-200 ${
                    showLoading ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'
                  }`}
                >
                  <div className="mb-1 text-2xl transition-transform duration-300 hover:rotate-12">
                    {showLoading ? '⏳' : '➕'}
                  </div>
                  <div className="transition-all duration-300">
                    <ComicText size={0.6} color={colors.textSecondary}>
                      {showLoading ? (
                        <span className="hint-text transition-all duration-300 ease-in-out">
                          Loading synonyms...
                        </span>
                      ) : (
                        <>
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

  const InputTypeToggle = React.memo(() => (
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
  ));

  return (
    <div
      className={`${backgroundColor} flex min-h-screen flex-col items-center p-5 transition-opacity duration-500 select-none`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      <Modal
        title={currentModalSynonym ? `Select a GIF for ${currentModalSynonym}` : "Select a GIF of your choice"}
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
              isCacheCheckingRef.current = false;
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
          isCacheCheckingRef.current = false;
          setShowSearchInput(false);
          setIsSearching(false);
          setIsCacheChecking(false);
          setLoadingStage(0); // Reset progress bar
          setGifs([]); // Clear GIFs
          setSelectedGifInModal(null);
          setCurrentModalSynonym(''); // Clear the synonym when closing
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
          {/* Show loading spinner if still waiting for results (even after timeout) */}
          {!isSearching && !isCacheChecking && isWaitingForResults && gifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500"></div>
              <ComicText size={0.6} color="#60A5FA" className="text-center mt-3">
                {isBatchPreFetching ? 'Preparing GIFs...' : 'Loading GIFs...'}
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
          {gifs.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => {
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
          {gifs.length > 0 && (
            <div className="flex justify-center mt-2 mb-2">
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
                <InputTypeToggle />
              </div>
              {disableSecretChange && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  Clear GIFs to change word/phrase
                </div>
              )}
          {/* Row 1: Category and Word/Phrase toggle */}
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
          <div className="flex items-center gap-3 justify-center mb-2">
            <div className="group relative">
              <button
                onClick={getNextRecommendation}
                disabled={disableSecretChange}
                className={`rounded-full px-3 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
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
                className={`rounded-full px-3 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                  !secretInput || synonyms.length < 4 || isCreating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
              <div className="animate-bounce-slow rounded-xl bg-gray-800 p-6 shadow-2xl max-w-md border-2 border-gray-600">
                <>
                  <div className="mb-4 text-4xl flex justify-center">
                    {bonusAwarded ? '🎉' : '⚠️'}
                  </div>
                  <ComicText size={1} color={colors.primary} className="mb-2 text-center">
                    {bonusAwarded ? (isQuickCreate ? 'Game Creation in Progress!' : 'Game Created Successfully!') : 'Daily Creation Limit Reached'}
                  </ComicText>
                  {bonusAwarded ? (
                    <>
                      <ComicText size={0.6} color="white" className="mb-2 text-center">
                        {isQuickCreate ? 'Your puzzle is being created...' : 'Your puzzle has been posted!'}
                      </ComicText>
                      <ComicText size={0.5} color="#94A3B8" className="mb-2 text-center">
                        Check the subreddit feed {isQuickCreate ? 'in a moment' : 'now'}
                      </ComicText>
                    </>
                  ) : (
                    <ComicText size={0.6} color="white" className="mb-2 text-center">
                      Try again tomorrow
                    </ComicText>
                  )}
                </>
                
                {bonusAwarded && (
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
                )}

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => {
                      // Navigate immediately without closing modal or fading
                      onNavigate('landing');
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
