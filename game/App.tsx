import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CreatePage } from './pages/CreatePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CategoryPage, CategoryType } from './pages/CategoryPage';
import { GamePage } from './pages/GamePage';
import { GameResultsPage } from './pages/GameResultsPage';
import { Page } from './lib/types';
import { ComicText } from './lib/fonts';
import { colors } from './lib/styles';

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
  const [navigationReceived, setNavigationReceived] = useState<boolean>(false);
  const [_initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(true);

  // Load game data when navigating to a game page
  useEffect(() => {
    if (currentPage === 'game' && gameId) {
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
      setGameId(urlGameId);
      setCurrentPage('game');
    }

    // Notify Devvit that the web view is ready
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    // Send initial message to request any data we need
    window.parent.postMessage({ type: 'INIT' }, '*');

    window.parent.postMessage({ type: 'requestNavigationState' }, '*');

    const fallbackTimer = setTimeout(() => {
      // Only set navigation received if it hasn't been set already
      if (!navigationReceived) {
        const lastPage = localStorage.getItem('lastPage');
        const lastGameId = localStorage.getItem('lastGameId');

        if (lastPage && lastGameId && lastPage === 'game') {
          setGameId(lastGameId);
          setCurrentPage(lastPage as Page);
        } else if (lastPage) {
          setCurrentPage(lastPage as Page);
        }

        setNavigationReceived(true);
      }

      setInitialLoadComplete(true);
      setIsNavigating(false);
    }, 2000);

    // Helper to handle the *unwrapped* message
    function handleUnwrappedMessage(message: any) {
      // Safety check to ensure we have a message with a type
      if (!message || typeof message !== 'object' || message === null) {
        return;
      }

      const messageType = message.type || message?.data?.type;
      if (!messageType) {
        return;
      }

      try {
        const typedMessage = message as DevvitMessage;

        // Handle random game result specifically
        if (typedMessage.type === 'GET_RANDOM_GAME_RESULT') {
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
            setGameId(gameData.id);
            // setCurrentPage('game');
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
              setSearchResults(typedMessage.results || []);
              setSearchError(null);
            } else {
              setSearchResults([]);
              setSearchError(typedMessage.error || 'Unknown error occurred');
            }
            break;

          case 'SET_NAVIGATION_STATE':
            if (typedMessage.data && typedMessage.data.page) {
              // Store the navigation state for recovery on reload if needed
              if (typedMessage.data.gameId) {
                localStorage.setItem('lastPage', typedMessage.data.page);
                localStorage.setItem('lastGameId', typedMessage.data.gameId);
              } else {
                // CRITICAL FIX: If no gameId provided, still store the page and clear gameId
                localStorage.setItem('lastPage', typedMessage.data.page);
                localStorage.removeItem('lastGameId');
              }

              // Check if this is a refresh navigation (gameId starts with 'refresh_')
              const isRefreshNavigation =
                typedMessage.data.gameId &&
                typeof typedMessage.data.gameId === 'string' &&
                typedMessage.data.gameId.startsWith('refresh_');

              // Handle normal game page navigation
              if (
                typedMessage.data.page === 'game' &&
                typedMessage.data.gameId &&
                !isRefreshNavigation
              ) {
                setGameId(typedMessage.data.gameId);
              }

              // CRITICAL FIX: When navigating to leaderboard or gameResults, preserve the gameId
              else if ((typedMessage.data.page === 'leaderboard' || typedMessage.data.page === 'gameResults') && typedMessage.data.gameId) {
                setGameId(typedMessage.data.gameId);
              }

              // Handle pages that don't need gameId by clearing it
              else if (
                typedMessage.data.page !== 'game' &&
                typedMessage.data.page !== 'leaderboard' &&
                typedMessage.data.page !== 'gameResults'
              ) {
                setGameId(null);
              }

              // If we're navigating to the current page and it's a refresh navigation
              if (typedMessage.data.page === currentPage && isRefreshNavigation) {
                // Force React to re-render by briefly changing to a different page
                setCurrentPage('landing'); // Temporary change to force refresh

                // Use requestAnimationFrame to schedule the change back
                requestAnimationFrame(() => {
                  setCurrentPage(typedMessage.data.page);
                  setIsNavigating(false);
                });
              } else {
                setCurrentPage(typedMessage.data.page);
                setIsNavigating(false);
              }
              setNavigationReceived(true);
              setInitialLoadComplete(true);
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
            if (typedMessage.success && typedMessage.page) {
              // Handle gameId for game page
              if (typedMessage.page === 'game' && typedMessage.gameId) {
                setGameId(typedMessage.gameId);
              }
              setCurrentPage(typedMessage.page);
            }
            break;

          case 'GET_GEMINI_RECOMMENDATIONS_RESULT':
            setIsLoading((prev) => ({ ...prev, recommendations: false }));
            if (typedMessage.success) {
              setRecommendations(typedMessage.result || []);
            }
            break;

          case 'GET_GEMINI_SYNONYMS_RESULT':
            setIsLoading((prev) => ({ ...prev, synonyms: false }));
            if (typedMessage.success) {
              setSynonyms(typedMessage.result || []);
            }
            break;

          case 'INIT_RESPONSE':
            if (typedMessage.data && typedMessage.data.desiredPage) {
              setCurrentPage(typedMessage.data.desiredPage);
            }
            break;

          case 'devvit-message':
            // Check if there's a message property inside the data
            if (message.data && message.data.message) {
              // Check for a game command specifically in the nested message
              if (message.data.message.type === 'GET_GAME_RESULT' && message.data.message.success) {
                if (message.data.message.game && message.data.message.game.id) {
                  setGameId(message.data.message.game.id);
                  // setCurrentPage('game'); 
                }
              }

              // Process the nested message
              handleUnwrappedMessage(message.data.message);
            }
            // Also check for direct navigation data in the message
            else if (message.data && message.data.page && message.data.gameId) {
              setGameId(message.data.gameId);
              // Only set to the specific page mentioned in the message
              setCurrentPage(message.data.page);
            }
            break;

          default:
            break;
        }
      } catch (error) {
        // Error processing message
      }
    }

    // Main message handler that unwraps any "devvit-message" wrappers
    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'webViewReady') {
        // Force a reset to landing page when the WebView is (re)mounted
        setCurrentPage('landing');
      }
      if (!event.data) {
        return;
      }

      const outer = event.data;

      try {
        // Extract gameId from message if present
        if (outer && typeof outer === 'object') {
          // Look for direct gameId in the outer message
          if (outer.gameId && typeof outer.gameId === 'string') {
            setGameId(outer.gameId);
          }

          // Look for gameId in nested structures
          if (outer.data && outer.data.gameId && typeof outer.data.gameId === 'string') {
            setGameId(outer.data.gameId);
          }

          // Look for gameId in params
          if (outer.data && outer.data.params && outer.data.params.gameId) {
            setGameId(outer.data.params.gameId);
          }

          // Look for gameId in game result
          if (outer.game && outer.game.id) {
            setGameId(outer.game.id);
          }
        }
        // Direct message handling - check if it's a plain object with a type
        if (outer && typeof outer === 'object' && outer.type) {
          handleUnwrappedMessage(outer);
          return;
        }

        // Handle devvit-message wrapper
        if (outer && outer.type === 'devvit-message') {
          // Double-wrapped scenario
          if (outer.data && outer.data.type === 'devvit-message' && outer.data.message) {
            handleUnwrappedMessage(outer.data.message);
          }
          // Handle message inside data property
          else if (outer.data && outer.data.message) {
            handleUnwrappedMessage(outer.data.message);
          }
          // Single-wrapped scenario
          else if (outer.data) {
            handleUnwrappedMessage(outer.data);
          }
        }
        // Fall back to trying the raw message
        else if (outer && typeof outer === 'object') {
          handleUnwrappedMessage(outer);
        }
      } catch (error) {
        // Error in message handler
      }
    }

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Function to send messages *to* Devvit
  const sendMessageToDevvit = (message: WebViewMessage) => {
    window.parent.postMessage(message, '*');
  };

  // Search Tenor GIFs
  const searchTenorGifs = (query: string, limit = 8) => {
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
    setIsLoading((prev) => ({ ...prev, synonyms: true }));
    sendMessageToDevvit({
      type: 'GET_GEMINI_SYNONYMS',
      data: {
        word,
      },
    });
  };

  const handleNavigate = (page: Page, params?: { gameId?: string }) => {
    // Block invalid game navigation
    if (page === 'game' && !params?.gameId) {
      return;
    }

    // CRITICAL FIX: Handle navigation to non-game pages properly
    if (
      page === 'howToPlay' ||
      page === 'leaderboard' ||
      page === 'landing' ||
      page === 'category' ||
      page === 'create' ||
      page === 'gameResults'
    ) {
      setCurrentPage(page);

      // Don't clear gameId for pages that need it
      if (page !== 'leaderboard' && page !== 'gameResults' && page !== ('game' as Page)) {
        setGameId(null);
      }

      // Store page for navigation persistence
      localStorage.setItem('lastPage', page);

      // Only store gameId for game, leaderboard, and gameResults pages
      if (page === ('game' as Page) || page === ('leaderboard' as Page) || page === 'gameResults') {
        if (params?.gameId) {
          localStorage.setItem('lastGameId', params.gameId);
        }
      } else {
        localStorage.removeItem('lastGameId');
      }

      // Notify server about navigation
      try {
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
        // Error sending navigation message
      }

      return; // Exit early - we've handled non-game navigation
    }

    // Handle game page navigation (original code)
    if (page === 'game' && params?.gameId) {
      setGameId(params.gameId);

      // Store navigation state for recovery if needed
      localStorage.setItem('lastPage', page);
      localStorage.setItem('lastGameId', params.gameId);

      setCurrentPage(page);
    } else {
      setCurrentPage(page);

      // Reset gameId if not needed
      if (page !== 'game' && page !== 'leaderboard' && page !== 'gameResults') {
        setGameId(null);
      }

      // Store only the page for non-game navigations
      localStorage.setItem('lastPage', page);
      if (page !== 'game' && page !== 'gameResults') {
        localStorage.removeItem('lastGameId');
      }
    }

    // AFTER updating local state, tell the server about the change
    try {
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
      // Error sending navigation message - continue anyway
    }
  };

  // Handle category selection
  const handleCategorySelect = (category: CategoryType) => {
    setSelectedCategory(category);
    setCurrentPage('create');
  };

  // Render the appropriate page
  const renderPage = () => {

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
        return <LeaderboardPage onNavigate={handleNavigate} username={userData?.username} gameId={gameId || undefined} />;
      case 'gameResults':
        // Safety check - redirect to landing if no gameId
        if (!gameId) {
          setTimeout(() => setCurrentPage('landing'), 0);
          return (
            <div className="flex h-screen items-center justify-center bg-[#E8E5DA] dark:bg-[#1A1A2E]">
              <div className="text-center">
                <ComicText size={1.2} color={colors.primary}>
                  Oops!
                </ComicText>
                <div className="mt-2">
                  <ComicText size={0.7} color={colors.textSecondary}>
                    Missing game data. Redirecting...
                  </ComicText>
                </div>
              </div>
            </div>
          );
        }
        return <GameResultsPage onNavigate={handleNavigate} gameId={gameId} />;
      case 'game':
        // Safety check - should never happen due to our handleNavigate logic
        if (!gameId) {
          setTimeout(() => setCurrentPage('landing'), 0);
          return (
            <div className="flex h-screen items-center justify-center bg-[#E8E5DA] dark:bg-[#1A1A2E]">
              <div className="text-center">
                <ComicText size={1.2} color={colors.primary}>
                  Oops!
                </ComicText>
                <div className="mt-2">
                  <ComicText size={0.7} color={colors.textSecondary}>
                    Missing game data. Redirecting...
                  </ComicText>
                </div>
              </div>
            </div>
          );
        }
        return <GamePage onNavigate={handleNavigate} gameId={gameId} />;
      default:
        return <LandingPage onNavigate={handleNavigate} {...commonProps} />;
    }
  };

  // Show loading spinner during navigation
  if (isNavigating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0d1629] dark:bg-[#1A2740]">
        <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
      </div>
    );
  }

  return <div className="app">{renderPage()}</div>;
}

export default App;
