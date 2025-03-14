import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';

type PageType = 'landing' | 'create' | 'howToPlay' | 'leaderboard';

// Define a consistent props interface for all pages
export interface NavigationProps {
  onNavigate: (page: PageType) => void;
}

// Define the message types for Devvit communication
type DevvitMessage =
  | { type: "initialData"; data: { username: string; currentCounter: number } }
  | { type: "updateCounter"; data: { currentCounter: number } };

type WebViewMessage =
  | { type: "webViewReady" }
  | { type: "setCounter"; data: { newCounter: number } };

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [userData, setUserData] = useState<{ username: string; currentCounter: number } | null>(null);

  // Setup communication with Devvit
  useEffect(() => {
    // Notify Devvit that the web view is ready
    window.parent.postMessage({ type: "webViewReady" }, '*');

    // Listen for messages from Devvit
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as DevvitMessage;
      
      if (message.type === "initialData") {
        setUserData(message.data);
      } else if (message.type === "updateCounter") {
        setUserData(prev => prev ? { ...prev, currentCounter: message.data.currentCounter } : null);
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

  const renderPage = () => {
    // Pass the Devvit communication functions and data to your pages
    const pageProps = {
      onNavigate: setCurrentPage,
      userData,
      sendMessageToDevvit
    };

    switch(currentPage) {
      case 'landing':
        return <LandingPage {...pageProps} />;
      case 'create':
        return <CreatePage {...pageProps} />;
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