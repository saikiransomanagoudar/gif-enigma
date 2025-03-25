import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CategoryPage, CategoryType } from './pages/CategoryPage';
import { GamePage } from './pages/GamePage';
import { Page } from './lib/types';

type DevvitMessage =
  | { type: 'initialData'; data: { username: string; currentCounter: number } }
  | { type: 'updateCounter'; data: { currentCounter: number } }
  | {
      type: 'SEARCH_TENOR_GIFS_RESULT';
      success: boolean;
      results?: any[];
      error?: string;
    }
  | {
      type: 'NAVIGATION_RESULT';
      success: boolean;
      page?: Page;
      gameId?: string;
      error?: string;
    }
  | {
      type: 'NAVIGATION';
      page: Page;
      gameId?: string;
    }
  | {
      type: 'GET_GEMINI_RECOMMENDATIONS_RESULT';
      success: boolean;
      result?: string[];
      error?: string;
    }
  | {
      type: 'GET_GEMINI_SYNONYMS_RESULT';
      success: boolean;
      result?: string[][];
      error?: string;
    }
  | {
      type: 'INIT_RESPONSE';
      data: {
        postId: string;
        desiredPage?: Page;
      };
    };

type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'setCounter'; data: { newCounter: number } }
  | {
      type: 'SEARCH_TENOR_GIFS';
      data: {
        query: string;
        limit?: number;
        contentfilter?: string;
        media_filter?: string;
      };
    }
  | {
      type: 'GET_GEMINI_RECOMMENDATIONS';
      data: {
        category: string;
        inputType: 'word' | 'phrase';
        count?: number;
      };
    }
  | {
      type: 'GET_GEMINI_SYNONYMS';
      data: { word: string };
    }
  | { type: 'INIT' }
  | {
      type: 'NAVIGATION';
      page: Page;
      gameId?: string;
    };

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('General');
  const [userData, setUserData] = useState<{ username: string; currentCounter: number } | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [synonyms, setSynonyms] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({
    recommendations: false,
    synonyms: false,
    search: false,
  });

  // Log whenever currentPage changes
  useEffect(() => {
    console.log("[DEBUG] App.tsx: currentPage updated:", currentPage);
  }, [currentPage]);

  useEffect(() => {
    // Notify Devvit that the web view is ready
    console.log('Frontend: WebView ready, sending webViewReady message');
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    // Send initial message to request any data we need
    console.log('Frontend: Sending INIT message');
    window.parent.postMessage({ type: 'INIT' }, '*');

    // Helper to handle the *unwrapped* message
    function handleUnwrappedMessage(message: DevvitMessage) {
      console.log('[DEBUG] App.tsx handleUnwrappedMessage:', message.type, message);

      switch (message.type) {
        case 'initialData':
          setUserData(message.data);
          break;

        case 'updateCounter':
          setUserData((prev) =>
            prev ? { ...prev, currentCounter: message.data.currentCounter } : null
          );
          break;

        case 'SEARCH_TENOR_GIFS_RESULT':
          setIsLoading((prev) => ({ ...prev, search: false }));
          if (message.success) {
            console.log('Frontend: Search results received:', message.results?.length);
            setSearchResults(message.results || []);
            setSearchError(null);
          } else {
            console.error('Frontend: Search error:', message.error);
            setSearchResults([]);
            setSearchError(message.error || 'Unknown error occurred');
          }
          break;

          case 'NAVIGATION':
            console.log('[DEBUG] App.tsx: Direct NAVIGATION message received:', message);
            // Handle gameId for game page
            if (message.page === 'game' && message.gameId) {
              console.log('[DEBUG] App.tsx: Setting gameId for game page:', message.gameId);
              setGameId(message.gameId);
            }
            console.log('[DEBUG] App.tsx: Updating currentPage to:', message.page);
            setCurrentPage(message.page);
            break;
            
          case 'NAVIGATION_RESULT':
            console.log('[DEBUG] App.tsx: NAVIGATION_RESULT received:', message);
            if (message.success && message.page) {
              // Handle gameId for game page
              if (message.page === 'game' && message.gameId) {
                console.log('[DEBUG] App.tsx: Setting gameId for game page:', message.gameId);
                setGameId(message.gameId);
              }
              console.log('[DEBUG] App.tsx: Updating currentPage to:', message.page);
              setCurrentPage(message.page);
            }
            break;

        case 'GET_GEMINI_RECOMMENDATIONS_RESULT':
          setIsLoading((prev) => ({ ...prev, recommendations: false }));
          if (message.success) {
            console.log('Frontend: Recommendations received:', message.result?.length);
            setRecommendations(message.result || []);
          } else {
            console.error('Frontend: Recommendations error:', message.error);
          }
          break;

        case 'GET_GEMINI_SYNONYMS_RESULT':
          setIsLoading((prev) => ({ ...prev, synonyms: false }));
          if (message.success) {
            console.log('Frontend: Synonyms received:', message.result?.length);
            setSynonyms(message.result || []);
          } else {
            console.error('Frontend: Synonyms error:', message.error);
          }
          break;

        case 'INIT_RESPONSE':
          console.log('[DEBUG] App.tsx: INIT_RESPONSE data:', message.data);
          console.log('Frontend: Init response received with postId:', message.data.postId);
          if (message.data.desiredPage) {
            console.log(
              '[DEBUG] App.tsx: Setting currentPage to desiredPage:',
              message.data.desiredPage
            );
            setCurrentPage(message.data.desiredPage);
          }
          break;

        default:
          console.error('[DEBUG] App.tsx: Unknown message type:', message);
          break;
      }
    }

    // Main message handler that unwraps any "devvit-message" wrappers
    function handleMessage(event: MessageEvent) {
      const outer = event.data;
      console.log('[DEBUG] App.tsx received raw:', outer);
    
      // Check for direct NAVIGATION message
      if (outer?.type === 'NAVIGATION') {
        console.log('[DEBUG] App.tsx: Direct NAVIGATION message detected');
        handleUnwrappedMessage(outer);
        return;
      }
    
      // Handle wrapped messages
      if (outer?.type === 'devvit-message') {
        // Handle doubly-wrapped message
        if (outer.data?.type === 'devvit-message' && outer.data?.message) {
          const actualMsg = outer.data.message;
          console.log('[DEBUG] App.tsx unwrapped second layer:', actualMsg);
          handleUnwrappedMessage(actualMsg);
        } 
        // Handle singly-wrapped message
        else if (outer.data) {
          const single = outer.data;
          console.log('[DEBUG] App.tsx unwrapped single layer:', single);
          handleUnwrappedMessage(single);
        }
      } 
      // Fall back to processing the raw message
      else if (outer && typeof outer === 'object') {
        console.log('[DEBUG] App.tsx: Processing raw message:', outer);
        handleUnwrappedMessage(outer);
      }
      else {
        console.log('[DEBUG] App.tsx: Unknown message format:', outer);
      }
    }

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Function to send messages *to* Devvit
  const sendMessageToDevvit = (message: WebViewMessage) => {
    window.parent.postMessage(message, '*');
  };

  // Search Tenor GIFs
  const searchTenorGifs = (query: string, limit = 8) => {
    console.log('Frontend: Searching Tenor GIFs for query:', query);
    setIsLoading((prev) => ({ ...prev, search: true }));
    sendMessageToDevvit({
      type: 'SEARCH_TENOR_GIFS',
      data: {
        query,
        limit,
        contentfilter: 'off',
        media_filter: 'minimal',
      },
    });
  };

  // Fetch Gemini recommendations
  const fetchGeminiRecommendations = (
    category: string,
    inputType: 'word' | 'phrase',
    count = 10
  ) => {
    console.log('Frontend: Fetching Gemini recommendations for category:', category);
    setIsLoading((prev) => ({ ...prev, recommendations: true }));
    sendMessageToDevvit({
      type: 'GET_GEMINI_RECOMMENDATIONS',
      data: {
        category,
        inputType,
        count,
      },
    });
  };

  // Fetch Gemini synonyms
  const fetchGeminiSynonyms = (word: string) => {
    console.log('Frontend: Fetching Gemini synonyms for word:', word);
    setIsLoading((prev) => ({ ...prev, synonyms: true }));
    sendMessageToDevvit({
      type: 'GET_GEMINI_SYNONYMS',
      data: {
        word,
      },
    });
  };

  // Handle category selection
  const handleCategorySelect = (category: CategoryType) => {
    console.log('Frontend: Category selected:', category);
    setSelectedCategory(category);
    setCurrentPage('create');
  };

  // Render the appropriate page
  const renderPage = () => {
    const pageProps = {
      onNavigate: setCurrentPage,
      userData,
      sendMessageToDevvit,
      searchTenorGifs,
      searchResults,
      searchError,
      isLoading,
      fetchGeminiRecommendations,
      fetchGeminiSynonyms,
      recommendations,
      synonyms,
    };

    console.log('Frontend: Rendering page:', currentPage);

    switch (currentPage) {
      case 'landing':
        return <LandingPage {...pageProps} />;
      case 'category':
        return <CategoryPage onNavigate={setCurrentPage} onCategorySelect={handleCategorySelect} />;
      case 'create':
        return <CreatePage context={undefined} {...pageProps} category={selectedCategory} />;
      case 'howToPlay':
        return <HowToPlayPage onNavigate={setCurrentPage} />;
      case 'leaderboard':
        return <LeaderboardPage onNavigate={setCurrentPage} />;
      case 'game':
        console.log('Frontend: Rendering GamePage with gameId:', gameId);
        return <GamePage onNavigate={setCurrentPage} gameId={gameId || ''} />;
      default:
        // Fallback to landing if currentPage is unrecognized
        return <LandingPage {...pageProps} />;
    }
  };

  return <div className="app">{renderPage()}</div>;
}

export default App;
