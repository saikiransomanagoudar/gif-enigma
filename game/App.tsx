import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CategoryPage, CategoryType } from './pages/CategoryPage';
import { GamePage } from './pages/GamePage';
import { Page } from './lib/types';

export type NavigationProps = {
  onNavigate: (path: string) => void;
};


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
  // | {
  //     type: 'NAVIGATION';
  //     page: Page;
  //     gameId?: string;
  //   }
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
    }
  | {
      type: 'SET_NAVIGATION_STATE';
      data: {
        page: Page;
        gameId?: string;
      };
    }
  | {
      type: 'GET_RANDOM_GAME_RESULT';
      success: boolean;
      game?: any;
      result?: any;
      error?: string;
    }
  | {
      type: 'devvit-message';
      data: {
        message: DevvitMessage;
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
  | { type: 'requestNavigationState' };
// | {
//     type: 'NAVIGATION';
//     page: Page;
//     gameId?: string;
//   };

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
    console.log('[DEBUG-CRITICAL] App.tsx: currentPage updated:', currentPage);
  }, [currentPage]);

  // Log whenever gameId changes
  useEffect(() => {
    console.log('[DEBUG-CRITICAL] App.tsx: gameId updated:', gameId);
  }, [gameId]);

  // Load game data when navigating to a game page
  useEffect(() => {
    if (currentPage === 'game' && gameId) {
      console.log('[DEBUG-CRITICAL] App.tsx: Loading game data for gameId:', gameId);

      // Fetch game data
      window.parent.postMessage(
        {
          type: 'GET_GAME',
          data: { gameId: gameId },
        },
        '*'
      );

      // Check if user has state for this game
      if (userData && userData.username) {
        window.parent.postMessage(
          {
            type: 'GET_GAME_STATE',
            data: {
              userId: userData.username,
              gameId: gameId,
            },
          },
          '*'
        );
      }
    }
  }, [currentPage, gameId, userData]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlGameId = urlParams.get('gameId');

    if (urlGameId) {
      console.log('[DEBUG-CRITICAL] App.tsx: Found gameId in URL params:', urlGameId);
      setGameId(urlGameId);
      setCurrentPage('game');
    }
    // Notify Devvit that the web view is ready
    console.log('Frontend: WebView ready, sending webViewReady message');
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    // Send initial message to request any data we need
    console.log('Frontend: Sending INIT message');
    window.parent.postMessage({ type: 'INIT' }, '*');

    console.log('Frontend: Requesting navigation state');
    window.parent.postMessage({ type: 'requestNavigationState' }, '*');

    // Helper to handle the *unwrapped* message
    function handleUnwrappedMessage(message: any) {
      // Safety check to ensure we have a message with a type
      if (!message || typeof message !== 'object' || message === null) {
        console.error('Invalid message structure');
        return;
      }

      const messageType = message.type || message?.data?.type;
      if (!messageType) {
        console.error('Message missing type property');
        return;
      }

      console.log('[DEBUG-DETAIL] App.tsx handleUnwrappedMessage:', message.type, message);

      try {
        // Use type assertion to treat as DevvitMessage
        const typedMessage = message as DevvitMessage;

        // Handle random game result specifically
        if (typedMessage.type === 'GET_RANDOM_GAME_RESULT') {
          console.log('[DEBUG-CRITICAL] App.tsx: GET_RANDOM_GAME_RESULT received:', typedMessage);

          // Extract game data from different possible formats
          let gameData = null;

          if (typedMessage.success && typedMessage.result && typedMessage.result.game) {
            // Format: {success: true, result: {success: true, game: {...}}}
            gameData = typedMessage.result.game;
          } else if (typedMessage.success && typedMessage.game) {
            // Format: {success: true, game: {...}}
            gameData = typedMessage.game;
          } else if (typedMessage.success && typedMessage.result) {
            // Format: {success: true, result: {...}}
            gameData = typedMessage.result;
          }

          if (gameData && gameData.id) {
            console.log('[DEBUG-CRITICAL] App.tsx: Extracted game ID:', gameData.id);
            setGameId(gameData.id);
            setCurrentPage('game');
          }
          return;
        }

        switch (typedMessage.type) {
          case 'initialData':
            setUserData(typedMessage.data);
            break;

          case 'updateCounter':
            setUserData((prev) =>
              prev ? { ...prev, currentCounter: typedMessage.data.currentCounter } : null
            );
            break;

          case 'SEARCH_TENOR_GIFS_RESULT':
            setIsLoading((prev) => ({ ...prev, search: false }));
            if (typedMessage.success) {
              console.log('Frontend: Search results received:', typedMessage.results?.length);
              setSearchResults(typedMessage.results || []);
              setSearchError(null);
            } else {
              console.error('Frontend: Search error:', typedMessage.error);
              setSearchResults([]);
              setSearchError(typedMessage.error || 'Unknown error occurred');
            }
            break;

          case 'SET_NAVIGATION_STATE':
            console.log('[DEBUG-CRITICAL] App.tsx: SET_NAVIGATION_STATE received:', typedMessage);
            if (typedMessage.data && typedMessage.data.page) {
              // Handle gameId for game page
              if (typedMessage.data.page === 'game' && typedMessage.data.gameId) {
                console.log(
                  '[DEBUG-CRITICAL] App.tsx: Setting gameId for game page:',
                  typedMessage.data.gameId
                );
                setGameId(typedMessage.data.gameId);
              }
              console.log(
                '[DEBUG-CRITICAL] App.tsx: Updating currentPage to:',
                typedMessage.data.page
              );
              setCurrentPage(typedMessage.data.page);
            }
            break;

          // case 'NAVIGATION':
          //   console.log(
          //     '[DEBUG-CRITICAL] App.tsx: Direct NAVIGATION message received:',
          //     typedMessage
          //   );
          //   // Handle gameId for game page
          //   if (typedMessage.page === 'game' && typedMessage.gameId) {
          //     console.log(
          //       '[DEBUG-CRITICAL] App.tsx: Setting gameId for game page:',
          //       typedMessage.gameId
          //     );
          //     setGameId(typedMessage.gameId);
          //   }
          //   console.log('[DEBUG-CRITICAL] App.tsx: Updating currentPage to:', typedMessage.page);
          //   setCurrentPage(typedMessage.page);
          //   break;

          case 'NAVIGATION_RESULT':
            console.log('[DEBUG-CRITICAL] App.tsx: NAVIGATION_RESULT received:', typedMessage);
            if (typedMessage.success && typedMessage.page) {
              // Handle gameId for game page
              if (typedMessage.page === 'game' && typedMessage.gameId) {
                console.log(
                  '[DEBUG-CRITICAL] App.tsx: Setting gameId for game page:',
                  typedMessage.gameId
                );
                setGameId(typedMessage.gameId);
              }
              console.log('[DEBUG-CRITICAL] App.tsx: Updating currentPage to:', typedMessage.page);
              setCurrentPage(typedMessage.page);
            }
            break;

          case 'GET_GEMINI_RECOMMENDATIONS_RESULT':
            setIsLoading((prev) => ({ ...prev, recommendations: false }));
            if (typedMessage.success) {
              console.log('Frontend: Recommendations received:', typedMessage.result?.length);
              setRecommendations(typedMessage.result || []);
            } else {
              console.error('Frontend: Recommendations error:', typedMessage.error);
            }
            break;

          case 'GET_GEMINI_SYNONYMS_RESULT':
            setIsLoading((prev) => ({ ...prev, synonyms: false }));
            if (typedMessage.success) {
              console.log('Frontend: Synonyms received:', typedMessage.result?.length);
              setSynonyms(typedMessage.result || []);
            } else {
              console.error('Frontend: Synonyms error:', typedMessage.error);
            }
            break;

          case 'INIT_RESPONSE':
            console.log('[DEBUG-CRITICAL] App.tsx: INIT_RESPONSE received:', typedMessage);
            if (typedMessage.data && typedMessage.data.desiredPage) {
              console.log(
                '[DEBUG-CRITICAL] App.tsx: Setting currentPage to desiredPage:',
                typedMessage.data.desiredPage
              );
              setCurrentPage(typedMessage.data.desiredPage);
            }
            break;

          case 'devvit-message':
            console.log('[DEBUG-DETAIL] App.tsx: Found nested devvit-message:', message);

            // Check if there's a message property inside the data
            if (message.data && message.data.message) {
              console.log(
                '[DEBUG-DETAIL] App.tsx: Found nested message inside data:',
                message.data.message
              );

              // Check for a game command specifically in the nested message
              if (message.data.message.type === 'GET_GAME_RESULT' && message.data.message.success) {
                console.log(
                  '[DEBUG-CRITICAL] App.tsx: Found game data in nested message:',
                  message.data.message.game
                );
                if (message.data.message.game && message.data.message.game.id) {
                  console.log(
                    '[DEBUG-CRITICAL] App.tsx: Setting gameId from nested game data:',
                    message.data.message.game.id
                  );
                  setGameId(message.data.message.game.id);
                  setCurrentPage('game'); // MOVE THIS INSIDE THE IF BLOCK
                }
              }

              // Process the nested message
              handleUnwrappedMessage(message.data.message);
            }
            // Also check for direct navigation data in the message
            else if (message.data && message.data.page && message.data.gameId) {
              console.log(
                '[DEBUG-CRITICAL] App.tsx: Found page and gameId in devvit-message data:',
                message.data.page,
                message.data.gameId
              );
              setGameId(message.data.gameId);
              // Only set to the specific page mentioned in the message
              setCurrentPage(message.data.page);
            }
            break;

          default:
            console.log(
              '[DEBUG-WARN] App.tsx: Unhandled message type:',
              (typedMessage as DevvitMessage).type
            );
            break;
        }
      } catch (error) {
        console.error('[DEBUG-ERROR] App.tsx: Error processing message:', error, message);
      }
    }

    // Main message handler that unwraps any "devvit-message" wrappers
    function handleMessage(event: MessageEvent) {
      if (!event.data) {
        console.log('[DEBUG-WARN] App.tsx received empty message data');
        return;
      }

      const outer = event.data;
      console.log(
        '[DEBUG-DETAIL] App.tsx received raw message of type:',
        typeof outer,
        outer?.type
      );

      try {
        // Extract gameId from message if present
        if (outer && typeof outer === 'object') {
          // Look for direct gameId in the outer message
          if (outer.gameId && typeof outer.gameId === 'string') {
            console.log('[DEBUG-CRITICAL] App.tsx: Found gameId in raw message:', outer.gameId);
            setGameId(outer.gameId);
          }

          // Look for gameId in nested structures
          if (outer.data && outer.data.gameId && typeof outer.data.gameId === 'string') {
            console.log(
              '[DEBUG-CRITICAL] App.tsx: Found gameId in message.data:',
              outer.data.gameId
            );
            setGameId(outer.data.gameId);
          }

          // Look for gameId in params
          if (outer.data && outer.data.params && outer.data.params.gameId) {
            console.log(
              '[DEBUG-CRITICAL] App.tsx: Found gameId in message.data.params:',
              outer.data.params.gameId
            );
            setGameId(outer.data.params.gameId);
          }

          // Look for gameId in game result
          if (outer.game && outer.game.id) {
            console.log('[DEBUG-CRITICAL] App.tsx: Found gameId in game result:', outer.game.id);
            setGameId(outer.game.id);
          }
        }
        // Direct message handling - check if it's a plain object with a type
        if (outer && typeof outer === 'object' && outer.type) {
          console.log('[DEBUG-DETAIL] App.tsx: Processing direct message with type:', outer.type);
          handleUnwrappedMessage(outer);
          return;
        }

        // Handle devvit-message wrapper
        if (outer && outer.type === 'devvit-message') {
          console.log('[DEBUG-DETAIL] App.tsx: Found devvit-message wrapper');

          // Double-wrapped scenario
          if (outer.data && outer.data.type === 'devvit-message' && outer.data.message) {
            console.log('[DEBUG-DETAIL] App.tsx: Unwrapping double-wrapped message');
            handleUnwrappedMessage(outer.data.message);
          }
          // Handle message inside data property
          else if (outer.data && outer.data.message) {
            console.log('[DEBUG-DETAIL] App.tsx: Found message inside data property');
            handleUnwrappedMessage(outer.data.message);
          }
          // Single-wrapped scenario
          else if (outer.data) {
            console.log('[DEBUG-DETAIL] App.tsx: Unwrapping single-wrapped message');
            handleUnwrappedMessage(outer.data);
          }
        }
        // Fall back to trying the raw message
        else if (outer && typeof outer === 'object') {
          console.log('[DEBUG-DETAIL] App.tsx: Trying raw message object');
          handleUnwrappedMessage(outer);
        }
      } catch (error) {
        console.error('[DEBUG-ERROR] App.tsx: Error in message handler:', error);
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

  const handleNavigate = (page: Page, params?: { gameId?: string }) => {
    console.log(`[NAV] App.tsx handleNavigate called:`, { page, params });

    // Block invalid game navigation
    if (page === 'game' && !params?.gameId) {
      console.error('[NAV] Cannot navigate to game without gameId');
      return;
    }

    // Set local state FIRST - this is the critical part
    if (page === 'game' && params?.gameId) {
      console.log(`[NAV] Setting gameId to: ${params.gameId}`);
      setGameId(params.gameId);
      console.log(`[NAV] Setting currentPage to: ${page}`);
      setCurrentPage(page);
    } else {
      console.log(`[NAV] Setting currentPage to: ${page}`);
      setCurrentPage(page);

      // Reset gameId if needed
      if (currentPage === 'game') {
        console.log('[NAV] Resetting gameId');
        setGameId(null);
      }
    }

    // AFTER updating local state, tell the server about the change
    // This is secondary - the UI should update even if this fails
    try {
      console.log(`[NAV] Notifying server about navigation:`, { page, params });
      window.parent.postMessage(
        {
          type: 'NAVIGATE',
          data: {
            page,
            params,
          },
        },
        '*'
      );
    } catch (err) {
      console.error('[NAV] Error sending navigation message to server:', err);
      // Continue anyway - local navigation is more important
    }
  };

  // Handle category selection
  const handleCategorySelect = (category: CategoryType) => {
    console.log('Frontend: Category selected:', category);
    setSelectedCategory(category);
    setCurrentPage('create');
  };

  // Render the appropriate page
  const renderPage = () => {
    console.log('[RENDER] Frontend: Rendering page:', currentPage, 'with gameId:', gameId);

    // Create pageProps without onNavigate property
    const commonProps = {
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

    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} {...commonProps} />;
      case 'category':
        return <CategoryPage onNavigate={setCurrentPage} onCategorySelect={handleCategorySelect} />;
      case 'create':
        return (
          <CreatePage
            context={undefined}
            {...commonProps}
            category={selectedCategory}
            onNavigate={handleNavigate}
          />
        );
      case 'howToPlay':
        return <HowToPlayPage onNavigate={setCurrentPage} />;
      case 'leaderboard':
        return (
          <LeaderboardPage
            onNavigate={setCurrentPage}
            username={userData?.username}
            postMessage={sendMessageToDevvit}
          />
        );
      case 'game':
        // Safety check - should never happen due to our handleNavigate logic
        if (!gameId) {
          console.error('[RENDER] Attempting to render GamePage without gameId!');
          setTimeout(() => setCurrentPage('landing'), 0);
          return (
            <div className="flex h-screen items-center justify-center">
              <p className="text-lg">Error: Missing game data. Redirecting...</p>
            </div>
          );
        }
        return <GamePage onNavigate={handleNavigate} gameId={gameId} />;
      default:
        console.log('[RENDER] Unrecognized currentPage:', currentPage);
        return <LandingPage onNavigate={handleNavigate} {...commonProps} />;
    }
  };

  return <div className="app">{renderPage()}</div>;
}

export default App;
