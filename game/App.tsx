import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CategoryPage, CategoryType } from './pages/CategoryPage';

type PageType = 'landing' | 'create' | 'category' | 'howToPlay' | 'leaderboard';

// consistent props interface for all pages
export interface NavigationProps {
  onNavigate: (page: PageType) => void;
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
    };

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('General');
  const [userData, setUserData] = useState<{ username: string; currentCounter: number } | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Setup communication with Devvit
  useEffect(() => {
    // Notify Devvit that the web view is ready
    window.parent.postMessage({ type: "webViewReady" }, '*');

    // Listen for messages from Devvit
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as DevvitMessage;
      
      switch(message.type) {
        case "initialData":
          setUserData(message.data);
          break;
        case "updateCounter":
          setUserData(prev => prev ? { ...prev, currentCounter: message.data.currentCounter } : null);
          break;
        case "SEARCH_TENOR_GIFS_RESULT":
          if (message.success) {
            setSearchResults(message.results || []);
            setSearchError(null);
          } else {
            setSearchResults([]);
            setSearchError(message.error || 'Unknown error occurred');
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup
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

  // Handle category selection and navigate to create page
  const handleCategorySelect = (category: CategoryType) => {
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
      searchError
    };

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