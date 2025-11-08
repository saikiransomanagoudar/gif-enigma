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

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate, category = 'Pop Culture' }) => {
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
  const currentWordRef = useRef<string>(''); // Track current word immediately, before state updates
  const hasShownDataRef = useRef<{ [key: string]: boolean }>({}); // Track if user has seen data for this cache key
  const pendingRequestsRef = useRef<Set<string>>(new Set()); // Track all pending API requests by cache key

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
  const [currentModalSynonym, setCurrentModalSynonym] = useState<string>(''); // Track which synonym is being searched

  // Frontend memory cache for GIF results per synonym - avoids repeated fetches in current session
  // Note: This is separate from Redis cache (backend). Redis cache has 24h TTL and benefits all users.
  // We clear this frontend cache when word changes for proper display, but Redis cache remains intact.
  const gifCache = useRef<{ [query: string]: TenorGifResult[] }>({});
  const isBatchFetching = useRef<boolean>(false);
  const currentCachedWord = useRef<string>(''); // Track which word the cache belongs to
  const currentSearchTermRef = useRef<string>(''); // Track the current search term for caching results
  const batchFetchingSynonyms = useRef<Set<string>>(new Set()); // Track which synonyms are being batch-fetched
  const pendingDisplaySynonym = useRef<string | null>(null); // Track if user is waiting for a specific synonym

  // UI states
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // @ts-ignore
  const [message, setMessage] = useState<string>('');
  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<number>(0); // 0, 1, 2 for progress steps
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isPageLoaded, setIsPageLoaded] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [bonusAwarded, setBonusAwarded] = useState<boolean>(true); // Track if bonus was awarded

  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const gifGridRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

  // Animate through loading stages - cycle through all stages continuously
  useEffect(() => {
    if (!isSearching) {
      setLoadingStage(0);
      return;
    }
    
    const timer1 = setTimeout(() => setLoadingStage(1), 1500);
    const timer2 = setTimeout(() => setLoadingStage(2), 3000);
    const timer3 = setTimeout(() => setLoadingStage(0), 4500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isSearching, loadingStage]);

  // Pre-fetch both word and phrase recommendations on mount for instant toggling
  useEffect(() => {
    // Pre-fetch the opposite type in the background for instant switching
    const oppositeType: 'word' | 'phrase' = inputType === 'word' ? 'phrase' : 'word';
    const oppositeCacheKey = `${currentCategory}-${oppositeType}`;
    
    if (!recommendationsCache.current[oppositeCacheKey]) {
      // Fetch in background without showing loading state
      setTimeout(() => {
        // Track this pre-fetch request
        pendingRequestsRef.current.add(oppositeCacheKey);
        
        window.parent.postMessage(
          {
            type: 'GET_GEMINI_RECOMMENDATIONS',
            data: {
              category: currentCategory,
              inputType: oppositeType,
              count: 20,
            },
          },
          '*'
        );
      }, 1000); // Small delay to not interfere with current fetch
    }
  }, [currentCategory, inputType]);

  useEffect(() => {
    if (category) {
      setCurrentCategory(category);
    }

    setSynonyms([]);
    setIsLoadingSynonyms(false);
    fetchRecommendations();
  }, [currentCategory, inputType]);

  const getFallbackRecommendations = () => {
    const fallbacks = {
      'Pop Culture': {
        word: ['RICKROLL', 'CRINGE', 'UNHINGED', 'AWKWARD', 'HYPE', 'SHOCKED', 'SALTY', 'FLEXING', 'VIBES', 'ICONIC'],
        phrase: ['MIC DROP', 'SIDE EYE', 'PLOT TWIST', 'GLOW UP', 'MAIN CHARACTER', 'VIBE CHECK', 'FACE PALM', 'MIND BLOWN', 'EPIC FAIL', 'HOT TAKE']
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

    const categoryData = fallbacks[currentCategory] || fallbacks['Pop Culture'];
    return categoryData[inputType] || categoryData['word'];
  };

  const fetchRecommendations = async () => {
    const cacheKey = `${currentCategory}-${inputType}`;
    
    // Check cache first
    if (recommendationsCache.current[cacheKey]) {
      const cachedData = recommendationsCache.current[cacheKey];
      setRecommendations(cachedData);
      setCurrentRecIndex(0);
      currentWordRef.current = cachedData[0]; // Update ref immediately
      setSecretInput(cachedData[0]);
      setIsLoadingRecommendations(false);
      hasShownDataRef.current[cacheKey] = true; // Mark as shown
      
      // Check if synonyms are already cached, otherwise show loading state
      if (synonymsCache.current[cachedData[0]]) {
        setSynonyms(synonymsCache.current[cachedData[0]]);
        setIsLoadingSynonyms(false);
      } else {
        // Show loading state instead of fallback
        setSynonyms([]);
        setIsLoadingSynonyms(true);
        // Then fetch real synonyms in background
        fetchSynonyms(cachedData[0]);
      }
      return;
    }
    
    // Show loading state immediately - no fallback data shown
    setIsLoadingRecommendations(true);
    setSecretInput('');
    setSynonyms([]);
    setIsLoadingSynonyms(true);
    
    // Track that we're making a request for this specific cache key
    pendingRequestsRef.current.add(cacheKey);
    
    // Send API request immediately
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
    
    // Fallback timeout after 10 seconds in case API fails
    setTimeout(() => {
      // Only show fallback if API hasn't responded yet (check if still pending)
      if (pendingRequestsRef.current.has(cacheKey)) {
        const fallbackData = getFallbackRecommendations();
        recommendationsCache.current[cacheKey] = fallbackData;
        setRecommendations(fallbackData);
        setSecretInput(fallbackData[0]);
        currentWordRef.current = fallbackData[0];
        setIsLoadingRecommendations(false);
        hasShownDataRef.current[cacheKey] = true;
        fetchSynonyms(fallbackData[0]);
        pendingRequestsRef.current.delete(cacheKey);
      }
    }, 10000);
  };

  const getFallbackSynonyms = (word: string) => {
    const synonymMap: { [key: string]: string[][] } = {
      // Words
      'ELEPHANT': [['animal', 'large', 'trunk', 'gray'], ['mammal', 'big', 'ivory', 'herd'], ['creature', 'huge', 'tusk', 'safari'], ['beast', 'massive', 'memory', 'zoo']],
      'BUTTERFLY': [['insect', 'wings', 'colorful', 'fly'], ['caterpillar', 'metamorphosis', 'beautiful', 'flutter'], ['pollinate', 'delicate', 'spring', 'garden'], ['transform', 'graceful', 'pattern', 'flower']],
      'RAINBOW': [['colors', 'rain', 'sky', 'arc'], ['spectrum', 'prism', 'light', 'beautiful'], ['seven', 'vibrant', 'nature', 'hope'], ['weather', 'bright', 'magical', 'end']],
      'MOUNTAIN': [['peak', 'high', 'climb', 'rock'], ['summit', 'elevation', 'hiking', 'snow'], ['range', 'altitude', 'view', 'nature'], ['hill', 'slope', 'adventure', 'trail']],
      'OCEAN': [['sea', 'water', 'waves', 'blue'], ['deep', 'vast', 'marine', 'salt'], ['current', 'tide', 'shore', 'fish'], ['aquatic', 'huge', 'surf', 'boat']],
      'STARWARS': [['space', 'lightsaber', 'force', 'jedi'], ['galaxy', 'darth', 'vader', 'rebel'], ['yoda', 'luke', 'princess', 'leia'], ['death', 'star', 'empire', 'hope']],
      'POKEMON': [['pikachu', 'catch', 'trainer', 'battle'], ['ash', 'gym', 'evolution', 'pokeball'], ['gotta', 'catch', 'em', 'all'], ['monster', 'creature', 'adventure', 'friend']],
      'HARRY': [['potter', 'wizard', 'hogwarts', 'magic'], ['spell', 'wand', 'voldemort', 'hermione'], ['ron', 'weasley', 'quidditch', 'dumbledore'], ['gryffindor', 'invisibility', 'cloak', 'phoenix']],
      'BATMAN': [['dark', 'knight', 'gotham', 'hero'], ['bruce', 'wayne', 'cape', 'bat'], ['joker', 'villain', 'justice', 'fight'], ['superhero', 'batmobile', 'robin', 'cave']],
      'FROZEN': [['ice', 'cold', 'snow', 'winter'], ['elsa', 'anna', 'princess', 'disney'], ['let it go', 'olaf', 'kingdom', 'magic'], ['sisters', 'love', 'frozen heart', 'snowman']],
      
      // Phrases - Movies
      'MAY THE FORCE BE WITH YOU': [['star wars', 'jedi', 'force', 'power'], ['lightsaber', 'space', 'galaxy', 'sci-fi'], ['luke skywalker', 'rebellion', 'empire', 'hope'], ['iconic', 'movie quote', 'blessing', 'farewell']],
      'I AM YOUR FATHER': [['star wars', 'darth vader', 'reveal', 'twist'], ['shocking', 'truth', 'dark side', 'villain'], ['luke', 'family', 'secret', 'father'], ['plot twist', 'iconic line', 'dramatic', 'revelation']],
      'TO INFINITY AND BEYOND': [['toy story', 'buzz', 'catchphrase', 'space'], ['adventure', 'limitless', 'forever', 'pixar'], ['toys', 'flying', 'heroic', 'optimistic'], ['iconic quote', 'animated', 'childhood', 'dreams']],
      
      // Phrases - Gaming
      'GAME OVER': [['defeat', 'lost', 'retry', 'arcade'], ['end', 'failure', 'try again', 'classic'], ['screen', 'gaming', 'finished', 'done'], ['retro', 'pixel', 'game end', 'loser']],
      'LEVEL UP': [['progress', 'upgrade', 'advance', 'skill'], ['gaming', 'achievement', 'success', 'grow'], ['experience', 'power up', 'improve', 'rank'], ['rpg', 'stats', 'stronger', 'victory']],
      'NEW HIGH SCORE': [['achievement', 'record', 'winner', 'best'], ['gaming', 'arcade', 'leaderboard', 'top'], ['success', 'victory', 'champion', 'first'], ['beat', 'highest', 'scoreboard', 'celebrate']],
      
      // Phrases - General
      'ONCE UPON A TIME': [['story', 'fairy tale', 'beginning', 'fantasy'], ['narrative', 'opening', 'classic', 'magical'], ['storybook', 'imagination', 'adventure', 'tale'], ['princess', 'kingdom', 'enchanted', 'legend']],
      'HAPPY BIRTHDAY': [['celebration', 'party', 'cake', 'gift'], ['congratulations', 'special day', 'wishes', 'joy'], ['balloons', 'candles', 'age', 'festive'], ['song', 'celebrate', 'present', 'friend']],
      'GOOD MORNING': [['greeting', 'hello', 'wake up', 'sunrise'], ['breakfast', 'early', 'start', 'day'], ['cheerful', 'fresh', 'new day', 'positive'], ['coffee', 'sunshine', 'smile', 'energy']],
    };

    return synonymMap[word.toUpperCase()] || [
      ['think', 'guess', 'solve', 'answer'],
      ['brain', 'mind', 'logic', 'reason'], 
      ['puzzle', 'mystery', 'riddle', 'challenge'],
      ['find', 'discover', 'reveal', 'uncover']
    ];
  };

  const fetchSynonyms = async (word: string) => {
    // Check cache first - but only use it if it's NOT fallback data
    if (synonymsCache.current[word]) {
      setSynonyms(synonymsCache.current[word]);
      setIsLoadingSynonyms(false);
      return;
    }
    
    // Show loading state immediately instead of fallback
    setSynonyms([]);
    setIsLoadingSynonyms(true);
    
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_SYNONYMS',
        data: { word },
      },
      '*'
    );
    
    // Fallback timeout after 10 seconds in case API fails
    const timeoutId = setTimeout(() => {
      // Only show fallback if we still don't have data for this specific word
      if (currentWordRef.current === word && (!synonymsCache.current[word] || synonymsCache.current[word].length === 0)) {
        const fallbackSynonyms = getFallbackSynonyms(word);
        setSynonyms(fallbackSynonyms);
        setIsLoadingSynonyms(false);
      }
    }, 10000);
    
    // Store timeout ID so we can clear it if needed
    return () => clearTimeout(timeoutId);
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
      currentWordRef.current = nextWord; // Update ref immediately
      setSecretInput(nextWord);
      
      // IMPORTANT: Clear frontend GIF cache when word changes for proper display
      // Note: Redis cache remains intact (24h TTL) so other users can benefit
      gifCache.current = {};
      isBatchFetching.current = false;
      batchFetchingSynonyms.current.clear(); // Clear batch tracking
      pendingDisplaySynonym.current = null; // Clear pending display
      currentCachedWord.current = nextWord; // Track the new word
      
      // Check if synonyms are already cached for instant update
      if (synonymsCache.current[nextWord]) {
        setSynonyms(synonymsCache.current[nextWord]);
        setIsLoadingSynonyms(false);
      } else {
        // Show loading state instead of fallback
        setSynonyms([]);
        setIsLoadingSynonyms(true);
        // Fetch real synonyms in background
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
        if (msg.success && Array.isArray(msg.result)) {
          const filtered = msg.result.filter((r: string) => r.length >= 5);
          
          // Find which pending request this response is for
          // Check both current and opposite types
          const currentCacheKey = `${currentCategory}-${inputType}`;
          const oppositeType: 'word' | 'phrase' = inputType === 'word' ? 'phrase' : 'word';
          const oppositeCacheKey = `${currentCategory}-${oppositeType}`;
          
          // Determine which cache key this response belongs to
          let cacheKey = currentCacheKey;
          if (pendingRequestsRef.current.has(currentCacheKey)) {
            cacheKey = currentCacheKey;
            pendingRequestsRef.current.delete(currentCacheKey);
          } else if (pendingRequestsRef.current.has(oppositeCacheKey)) {
            cacheKey = oppositeCacheKey;
            pendingRequestsRef.current.delete(oppositeCacheKey);
          }
          // If neither pending, default to current (shouldn't happen)
          
          // Store the API result in the correct cache
          recommendationsCache.current[cacheKey] = filtered;
          
          // Only update UI if this is for the current active type
          if (cacheKey === currentCacheKey && filtered.length > 0) {
            setIsLoadingRecommendations(false);
            
            // Update UI with API data
            setRecommendations(filtered);
            setCurrentRecIndex(0);
            currentWordRef.current = filtered[0]; // Update ref immediately
            setSecretInput(filtered[0]);
            hasShownDataRef.current[cacheKey] = true; // Mark as shown
            
            // Fetch synonyms for the first word
            fetchSynonyms(filtered[0]);
            
            // Pre-fetch synonyms for ALL recommendations in the background
            filtered.slice(1).forEach((word: string, index: number) => {
              // Stagger the requests slightly to avoid overwhelming the API
              setTimeout(() => {
                if (!synonymsCache.current[word]) {
                  window.parent.postMessage(
                    {
                      type: 'GET_GEMINI_SYNONYMS',
                      data: { word },
                    },
                    '*'
                  );
                }
              }, (index + 1) * 500); // 500ms delay between each request
            });
          }
        } else {
          // Only show fallback if we don't already have data
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
        if (msg.success && Array.isArray(msg.result) && msg.result.length > 0) {
          // Cache successful synonyms response
          // Use msg.word if available (for pre-fetched synonyms), otherwise use currentWordRef
          const wordForCache = msg.word || currentWordRef.current;
          if (wordForCache) {
            synonymsCache.current[wordForCache] = msg.result;
          }
          // Only update UI if this is for the current word (use ref for immediate comparison)
          if (wordForCache === currentWordRef.current) {
            setSynonyms(msg.result);
            // Only stop loading if we actually have data now
            if (msg.result.length >= 4) {
              setIsLoadingSynonyms(false);
            }
          }
        } else {
          // On failure, show fallback only for the current word
          if (currentWordRef.current && !synonymsCache.current[currentWordRef.current]) {
            const fallbackSynonyms = getFallbackSynonyms(currentWordRef.current);
            setSynonyms(fallbackSynonyms);
            setIsLoadingSynonyms(false); // Stop loading after showing fallback
          }
        }
      }

      if (msg.type === 'SEARCH_TENOR_GIFS_RESULT') {
        setIsSearching(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (msg.success && Array.isArray(msg.results)) {
          // IMPORTANT: Cache the results using the ref so subsequent clicks are instant
          const searchedTerm = currentSearchTermRef.current;
          if (searchedTerm && msg.results.length > 0) {
            gifCache.current[searchedTerm] = msg.results;
          }
          
          setGifs(msg.results);
          if (msg.results.length === 0) {
            setMessage('No GIFs found for this search term. Try a different synonym.');
            setMessageType('error');
          } else {
            setMessage(`Found ${msg.results.length} GIFs! Click one to select it.`);
            setMessageType('success');
          }
          
          // IMPORTANT: Trigger batch fetch AFTER displaying 1st synonym
          // This happens in the background and doesn't block the UI
          if (currentSearchTermRef.current) {
            const firstSynonym = currentSearchTermRef.current;
            const currentWord = currentWordRef.current;
            
            // Get synonyms from cache (more reliable than state)
            const cachedSynonyms = synonymsCache.current[currentWord];
            
            if (cachedSynonyms && cachedSynonyms.length >= 4 && !isBatchFetching.current) {
              isBatchFetching.current = true;
              // Get all synonyms from cache
              const allSynonyms = cachedSynonyms.map(group => group[0]).filter(s => s && s.trim() !== '');
              batchFetchRemainingGifs(firstSynonym, allSynonyms);
            }
          }
        } else {
          setGifs([]);
          setMessage('Failed to load GIFs. Please try again.');
          setMessageType('error');
        }
      }

      if (msg.type === 'SEARCH_BATCH_TENOR_GIFS_RESULT') {
        if (msg.success && msg.results) {
          // Store all results in cache
          Object.keys(msg.results).forEach((query) => {
            const gifsForQuery = msg.results![query];
            gifCache.current[query] = gifsForQuery;
            
            // Remove from batch fetching set
            batchFetchingSynonyms.current.delete(query);
          });
          
          // Check if user is waiting for one of these synonyms
          if (pendingDisplaySynonym.current && gifCache.current[pendingDisplaySynonym.current]) {
            const waitingFor = pendingDisplaySynonym.current;
            setGifs(gifCache.current[waitingFor]);
            setIsSearching(false);
            setMessage(`Found ${gifCache.current[waitingFor].length} GIFs! Click one to select it.`);
            setMessageType('success');
            pendingDisplaySynonym.current = null;
          }
        } else {
          // Clear the batch fetching set on error
          batchFetchingSynonyms.current.clear();
          
          // If user was waiting, show error
          if (pendingDisplaySynonym.current) {
            setIsSearching(false);
            setMessage('Failed to load GIFs. Please try again.');
            setMessageType('error');
            pendingDisplaySynonym.current = null;
          }
        }
        
        // Reset the batch fetching flag so it can be triggered again if needed
        isBatchFetching.current = false;
      }

      if (msg.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);
        if (msg.success && msg.result && msg.result.success) {
          // Track whether the creation bonus was awarded
          setBonusAwarded(msg.result.bonusAwarded !== false); // Default to true if not specified
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
    
    // IMPORTANT: Always clear previous GIFs first to prevent mixing
    setGifs([]);
    setSelectedGifInModal(null);
    
    // Track the search term for caching when results arrive
    currentSearchTermRef.current = term;
    
    // ALWAYS clear GIFs first to prevent mixing between synonyms
    setGifs([]);
    
    // Check cache first - instant response!
    if (gifCache.current[term]) {
      setGifs(gifCache.current[term]);
      setIsSearching(false);
      return;
    }
    
    // Check if this synonym is currently being batch-fetched
    if (batchFetchingSynonyms.current.has(term)) {
      setIsSearching(true);
      pendingDisplaySynonym.current = term; // Mark that we're waiting for this synonym
      return; // Don't trigger a duplicate fetch
    }
        
    // If not cached and not being batch-fetched, show loading and fetch individually
    setIsSearching(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    window.parent.postMessage(
      {
        type: 'SEARCH_TENOR_GIFS',
        data: { query: term, limit: 12 },
      },
      '*'
    );
    timeoutRef.current = setTimeout(() => {
      setIsSearching(false);
      setMessage('Search timed out. Please try again.');
      setMessageType('error');
    }, 25000); // Balanced timeout - not too aggressive
  };

  /**
   * Batch fetch GIFs for remaining synonyms (not the currently clicked one).
   * This is called AFTER the clicked synonym's GIFs are already being fetched,
   * so we fetch the other 3 synonyms in the background for instant future access.
   */
  const batchFetchRemainingGifs = (excludeSynonym: string, allSynonyms: string[]) => {
    // Validate we have enough synonyms
    if (allSynonyms.length < 4) {
      return;
    }

    // Exclude the currently clicked synonym - we're already fetching it separately
    const remainingSynonyms = allSynonyms.filter(s => s !== excludeSynonym);
    
    // Check if any remaining synonyms are not cached
    const uncachedSynonyms = remainingSynonyms.filter(s => !gifCache.current[s]);
    
    if (uncachedSynonyms.length === 0) {
      return;
    }
    
    // Mark these synonyms as being batch-fetched
    uncachedSynonyms.forEach(synonym => {
      batchFetchingSynonyms.current.add(synonym);
    });

    // Fetch remaining synonyms' GIFs in one batch request (background)
    window.parent.postMessage(
      {
        type: 'SEARCH_BATCH_TENOR_GIFS',
        data: { 
          queries: uncachedSynonyms,
          limit: 12 
        },
      },
      '*'
    );
    
    setTimeout(() => {
      uncachedSynonyms.forEach(synonym => {
        // Only clear if still pending (not in cache)
        if (!gifCache.current[synonym]) {
          batchFetchingSynonyms.current.delete(synonym);
        }
      });
      
      // If user is waiting for a pending synonym, trigger individual fetch seamlessly
      if (pendingDisplaySynonym.current && !gifCache.current[pendingDisplaySynonym.current]) {
        const waitingSynonym = pendingDisplaySynonym.current;
        pendingDisplaySynonym.current = null;
        // Fetch individually - user won't see any error, just normal loading
        searchGifs(waitingSynonym);
      }
    }, 50000); // Balanced timeout for batch fetch
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
      
      // Close modal first, then clear gifs after a brief delay
      setShowSearchInput(false);
      setSelectedGifInModal(null);
      setMessageType('success');
      
      // Clear gifs after modal closes to prevent flash of empty state
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

      // Extract GIF descriptions for validation
      const gifDescriptions = validGifs.map((gif) => 
        gif.content_description || gif.title || 'No description'
      );

      // Extract the search terms used (first term from each synonym group)
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
          // Show loading if we don't have enough synonyms yet (need at least 4)
          const showLoading = synonyms.length < 4 || !defaultSynonym;

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
                    if (!showLoading && defaultSynonym) {
                      // Validate frontend cache: If word changed, clear stale frontend cache
                      // (Redis cache stays intact for other users - handled by backend TTL)
                      if (currentCachedWord.current !== secretInput) {
                        gifCache.current = {};
                        isBatchFetching.current = false;
                        batchFetchingSynonyms.current.clear();
                        pendingDisplaySynonym.current = null;
                        currentCachedWord.current = secretInput;
                      }
                      
                      // First: Immediately fetch and display the clicked synonym's GIFs
                      setSelectedGifIndex(index);
                      setCurrentModalSynonym(defaultSynonym); // Set the synonym for modal display
                      setShowSearchInput(true);
                      setSearchTerm(defaultSynonym);
                      setMessage('');
                      setMessageType('info');
                      searchGifs(defaultSynonym); // Fetches ONLY 1st synonym, batch fetch happens AFTER result
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
        title={currentModalSynonym ? `Select a GIF for ${currentModalSynonym}` : "Select a GIF of your choice"}
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
          setCurrentModalSynonym(''); // Clear the synonym when closing
        }}
        onConfirm={() => {
          if (selectedGifInModal) {
            // Don't clear gifs immediately to prevent showing empty state
            selectGifForSlot(selectedGifInModal);
          }
        }}
        confirmDisabled={!selectedGifInModal}
      >
        <div className="flex flex-col gap-4">
           {isSearching && (
             <div className="flex flex-col items-center justify-center pt-12 pb-8">
               <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
               <div className="mt-2">
                 <ComicText size={0.7} color="#60A5FA" className="text-center">
                   {loadingStage === 0 && `🔍 Analyzing your ${inputType}...`}
                   {loadingStage === 1 && '🎬 Searching GIF library...'}
                   {loadingStage === 2 && '✨ Selecting best matches...'}
                 </ComicText>
               </div>
               {/* <ComicText size={0.5} color="#94A3B8" className="mt-2 text-center">
                 First load may take 10-15 seconds
               </ComicText> */}
             </div>
           )}
          {!isSearching && gifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <ComicText size={0.6} color="#94A3B8" className="text-center">
                No GIFs found. Try a different word/phrase.
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
                      : '🔥'}
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
                
                {/* XP Bonus Display - Conditional based on bonusAwarded */}
                {bonusAwarded ? (
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
                ) : (
                  <div className="mt-6 mb-4 flex items-center justify-center">
                    <div className="rounded-lg border-2 border-orange-400 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 shadow-lg">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">⚠️</span>
                        <div className="text-center">
                          <ComicText size={0.45} color="white">
                            Creation Limit Reached
                          </ComicText>
                          <ComicText size={0.35} color="white" className="mt-1">
                            You've created 4 games in 24h
                          </ComicText>
                          <ComicText size={0.35} color="white">
                            No bonus XP this time
                          </ComicText>
                        </div>
                        <span className="text-lg">⚠️</span>
                      </div>
                    </div>
                  </div>
                )}

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
