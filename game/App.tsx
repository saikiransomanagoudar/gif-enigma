import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CategoryPage, CategoryType } from './pages/CategoryPage';
import { GamePage } from './pages/GamePage';

type PageType = 'landing' | 'create' | 'category' | 'howToPlay' | 'leaderboard' | 'game';

export interface NavigationProps {
  onNavigate: (page: PageType) => void;
  gameId?: string;
}

// Define the message types for Devvit communication
type DevvitMessage =
  | { type: "initialData"; data: { username: string; currentCounter: number } }
  | { type: "updateCounter"; data: { currentCounter: number } }
  | { 
      type: "SEARCH_TENOR_GIFS_RESULT"; 
      success: boolean; 
      results?: any[]; 
      error?: string 
    }
  | {
      type: "NAVIGATION_RESULT";
      success: boolean;
      page?: PageType;  
      gameId?: string;
      error?: string;
    }
  | {
      type: "GET_GEMINI_RECOMMENDATIONS_RESULT";
      success: boolean;
      result?: string[];
      error?: string;
    }
  | {
      type: "GET_GEMINI_SYNONYMS_RESULT";
      success: boolean;
      result?: string[][];
      error?: string;
    }
  | {
      type: "INIT_RESPONSE";
      data: {
        postId: string;
      };
    };

type WebViewMessage =
  | { type: "webViewReady" }
  | { type: "setCounter"; data: { newCounter: number } }
  | { 
      type: "SEARCH_TENOR_GIFS"; 
      data: { 
        query: string; 
        limit?: number;
        contentfilter?: string;
        media_filter?: string;
      } 
    }
  | {
      type: "GET_GEMINI_RECOMMENDATIONS";
      data: { 
        category: string; 
        inputType: 'word' | 'phrase'; 
        count?: number 
      };
    }
  | { 
      type: "GET_GEMINI_SYNONYMS"; 
      data: { word: string } 
    }
  | { type: "INIT" };

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('General');
  const [userData, setUserData] = useState<{ username: string; currentCounter: number } | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [synonyms, setSynonyms] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({
    recommendations: false,
    synonyms: false,
    search: false
  });

  // Setup communication with Devvit
  useEffect(() => {
    // Notify Devvit that the web view is ready
    console.log('Frontend: WebView ready, sending webViewReady message');
    window.parent.postMessage({ type: "webViewReady" }, '*');

    // Send initial message to request any data we need
    console.log('Frontend: Sending INIT message');
    window.parent.postMessage({ type: "INIT" }, '*');

    // Listen for messages from Devvit
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as DevvitMessage;
      console.log('Frontend: Received message from parent:', message.type, message);
      
      switch(message.type) {
        case "initialData":
          setUserData(message.data);
          break;
          
        case "updateCounter":
          setUserData(prev => prev ? { ...prev, currentCounter: message.data.currentCounter } : null);
          break;
          
        case "SEARCH_TENOR_GIFS_RESULT":
          setIsLoading(prev => ({...prev, search: false}));
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
          
        case "NAVIGATION_RESULT":
          if (message.success && message.page) {
            console.log('Frontend: Navigation result received, going to page:', message.page);
            
            // If navigating to game page, store the game ID
            if (message.page === 'game' && message.gameId) {
              setGameId(message.gameId);
            }
            
            // Update the current page
            setCurrentPage(message.page);
          } else if (!message.success) {
            console.error('Frontend: Navigation failed:', message.error);
          }
          break;
          
        case "GET_GEMINI_RECOMMENDATIONS_RESULT":
          setIsLoading(prev => ({...prev, recommendations: false}));
          if (message.success) {
            console.log('Frontend: Recommendations received:', message.result?.length);
            setRecommendations(message.result || []);
          } else {
            console.error('Frontend: Recommendations error:', message.error);
            // Keep the existing recommendations if there's an error
          }
          break;
          
        case "GET_GEMINI_SYNONYMS_RESULT":
          setIsLoading(prev => ({...prev, synonyms: false}));
          if (message.success) {
            console.log('Frontend: Synonyms received:', message.result?.length);
            setSynonyms(message.result || []);
          } else {
            console.error('Frontend: Synonyms error:', message.error);
            // Keep the existing synonyms if there's an error
          }
          break;
          
        case "INIT_RESPONSE":
          console.log('Frontend: Init response received with postId:', message.data.postId);
          // You can store the postId if needed
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Function to send messages to Devvit
  const sendMessageToDevvit = (message: WebViewMessage) => {
    window.parent.postMessage(message, '*');
  };

  // Function to search Tenor GIFs
  const searchTenorGifs = (query: string, limit = 8) => {
    console.log('Frontend: Searching Tenor GIFs for query:', query);
    setIsLoading(prev => ({...prev, search: true}));
    sendMessageToDevvit({
      type: "SEARCH_TENOR_GIFS",
      data: {
        query,
        limit,
        contentfilter: 'off',
        media_filter: 'minimal'
      }
    });
  };

  // Function to fetch Gemini recommendations
  const fetchGeminiRecommendations = (category: string, inputType: 'word' | 'phrase', count = 10) => {
    console.log('Frontend: Fetching Gemini recommendations for category:', category);
    setIsLoading(prev => ({...prev, recommendations: true}));
    sendMessageToDevvit({
      type: "GET_GEMINI_RECOMMENDATIONS",
      data: {
        category,
        inputType,
        count
      }
    });
  };

  // Function to fetch Gemini synonyms
  const fetchGeminiSynonyms = (word: string) => {
    console.log('Frontend: Fetching Gemini synonyms for word:', word);
    setIsLoading(prev => ({...prev, synonyms: true}));
    sendMessageToDevvit({
      type: "GET_GEMINI_SYNONYMS",
      data: {
        word
      }
    });
  };

  // Handle category selection and navigate to create page
  const handleCategorySelect = (category: CategoryType) => {
    console.log('Frontend: Category selected:', category);
    setSelectedCategory(category);
    setCurrentPage('create');
  };

  const renderPage = () => {
    // Pass the Devvit communication functions and data to your pages
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
      synonyms
    };

    console.log('Frontend: Rendering page:', currentPage);
    
    switch(currentPage) {
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
        return <GamePage onNavigate={setCurrentPage} gameId={gameId || ''} />;  
      default:
        return <LandingPage {...pageProps} />;
    }
  };

  return (
    <div className="app">
      {renderPage()}
    </div>
  );
}

export default App;