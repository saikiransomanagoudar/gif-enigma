import { Devvit, Context, useState, useAsync } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { BlocksToWebviewMessage } from '../../game/shared.js';

interface CustomPostPreviewProps {
  context: Context;
  onMount: () => void;
  postMessage: (message: BlocksToWebviewMessage) => void;
  isWebViewReady: boolean;
}

// Global debounce tracker - persists across component renders
let lastClickTime = 0;
const DEBOUNCE_MS = 2000; // 2 second debounce

export const CustomPostPreview = ({
  context,
  onMount,
  postMessage,
  isWebViewReady,
}: CustomPostPreviewProps) => {
  const screenWidth = context.dimensions?.width || 0;
  const isSmallScreen = screenWidth < 420;
  const cardSize = isSmallScreen
    ? Math.floor((screenWidth || 320) * 0.4)
    : Math.floor((screenWidth || 800) * 0.25);
  
  // Add state to prevent multiple clicks
  const [isSearching, setIsSearching] = useState(false);
  
  // Load initial data once - use data directly, no state
  const { data: initialData, loading } = useAsync(
    async () => {
      const playGifUrl = context.assets.getURL('eyebrows.gif');
      const buildGifUrl = context.assets.getURL('lets-build-optimized.gif');
      const currentUsername = (await context.reddit.getCurrentUsername()) || 'there';

      return {
        playGifUrl,
        buildGifUrl,
        currentUsername,
      };
    },
    {
      depends: [],
    }
  );
  
  const username = initialData?.currentUsername || 'there';
  const isLoading = loading;

  const handlePlayGame = async (retryCount = 0) => {
    // Global debouncing - check time since last click (but allow retries to bypass)
    const now = Date.now();
    if (retryCount === 0 && now - lastClickTime < DEBOUNCE_MS) {
      return;
    }
    
    // Update timestamp only for initial clicks, not retries
    if (retryCount === 0) {
      lastClickTime = now;
    }
    
    // Prevent multiple simultaneous calls
    if (isSearching) {
      return;
    }
    
    setIsSearching(true);
    const MAX_RETRIES = 3;

    try {
      // Don't show toast here - it stays visible and confuses users
      // context.ui.showToast('🔍 Finding a game...');
      
      const { getRandomGame } = await import('../../game/server/gameHandler.server.js');

      const params = {
        excludeIds: [],
        preferUserCreated: true,
        username: username || 'anonymous',
      };

      // Reduce timeout to 8 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 8000)
      );

      const result: any = await Promise.race([
        getRandomGame(params, context),
        timeoutPromise
      ]).catch(err => {
        // Catch any errors including timeout
        setIsSearching(false);
        return { success: false, error: err.message || 'Failed to get game' };
      });
      
      if (result.success && result.game) {
        const game = result.game;
                
        if (game.redditPostId && game.gifs && Array.isArray(game.gifs) && game.gifs.length > 0 && game.word) {
          // Navigate to the specific game post directly
          try {
            const post = await context.reddit.getPostById(game.redditPostId);
            
            if (post && !post.removed) {
              // Show brief success toast (will auto-clear on navigation)
              context.ui.showToast({
                text: '🎮 Game found!',
                appearance: 'success',
              });
              
              // Reset state
              setIsSearching(false);
              
              // Navigate immediately - the toast is just a brief flash
              if (post.url) {
                context.ui.navigateTo(post.url);
              } else if (post.permalink) {
                const fullUrl = `https://www.reddit.com${post.permalink}`;
                context.ui.navigateTo(fullUrl);
              } else {
                // Fallback: construct URL manually
                const cleanPostId = game.redditPostId.replace('t3_', '');
                const postUrl = `https://www.reddit.com/r/PlayGIFEnigma/comments/${cleanPostId}/`;
                context.ui.navigateTo(postUrl);
              }
            } else {
              setIsSearching(false);
              if (retryCount < MAX_RETRIES) {
                handlePlayGame(retryCount + 1);
              } else {
                context.ui.showToast('Could not find a valid game to play. Please try again.');
              }
            }
          } catch (error) {
            setIsSearching(false);
            // Try to find another game with retry limit
            if (retryCount < MAX_RETRIES) {
              handlePlayGame(retryCount + 1);
            } else {
              context.ui.showToast('Error finding a game. Please try again.');
            }
          }
        } else {
          setIsSearching(false);
          context.ui.showToast('Could not find a valid game to play. Please try again.');
        }
      } else {
        setIsSearching(false);
        
        // Show contextual error messages based on the scenario
        if (result.hasPlayedAll) {
          // User has played all available games
          context.ui.showToast('🎉 Amazing! You\'ve completed all games! Check back later for new challenges.');
        } else if (result.error && result.error.includes('No games available yet')) {
          // No games exist in the system
          context.ui.showToast('🎨 No games yet! Be the first to create one by tapping "Let\'s Build"');
        } else if (result.error) {
          // Other errors from backend
          context.ui.showToast(result.error);
        } else {
          // Generic fallback
          context.ui.showToast('😕 No games available right now. Try creating one!');
        }
      }
      
    } catch (error) {
      setIsSearching(false);
      // Handle timeout or other errors
      const errorMessage = error instanceof Error && error.message.includes('timeout') 
        ? 'Request timed out. Please try again.'
        : error instanceof Error 
          ? error.message
          : 'Error finding a game. Please try again.';
      context.ui.showToast(errorMessage);
    }
  };

  const handleCreateGame = async () => {
    try {
      // Store category page as the destination
      if (context.postId) {
        await context.redis.hSet(`navState:${context.postId}`, {
          page: 'category',
        });   
      }

      onMount();
      
      // Send navigation directly if webview is ready
      if (isWebViewReady) {
        postMessage({
          type: 'SET_NAVIGATION_STATE',
          data: {
            page: 'category',
          },
        });
      }
    } catch (error) {
      onMount();
      
      if (isWebViewReady) {
        postMessage({
          type: 'SET_NAVIGATION_STATE',
          data: {
            page: 'category',
          },
        });
      }
    }
  };

  const handleHowToPlay = async () => {
    try {
      // Store how to play page as the destination
      if (context.postId) {
        await context.redis.hSet(`navState:${context.postId}`, {
          page: 'howToPlay',
        });
      }

      onMount();
      
      if (isWebViewReady) {
        postMessage({
          type: 'SET_NAVIGATION_STATE',
          data: {
            page: 'howToPlay',
          },
        });
      }
    } catch (error) {
      onMount();
      
      if (isWebViewReady) {
        postMessage({
          type: 'SET_NAVIGATION_STATE',
          data: {
            page: 'howToPlay',
          },
        });
      }
    }
  };

  return (
    <zstack width="100%" height="100%">
      {/* Main content */}
      <vstack height="100%" width="100%" darkBackgroundColor="#0d1629" lightBackgroundColor="#E8E5DA">
        <spacer size="large" />

      {/* Title */}
      <vstack alignment="center middle" padding="xsmall">
        <spacer size="large" />
        <spacer size="large" />
        {isSmallScreen && <spacer size="large" />}
        
        <ComicText size={isSmallScreen ? 0.5 : 0.6} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {isLoading ? (
        <vstack width="100%" height={`${cardSize + 32}px`} alignment="center middle">
          <spacer size="small" />
        </vstack>
      ) : (
        <hstack width="100%" height={`${cardSize + 32}px`} padding="small" alignment="center middle" gap="small">
          {/* Let's Play Card */}
          <vstack
            backgroundColor="#c6c6e1"
            cornerRadius="large"
            width={`${cardSize}px`}
            height={`${cardSize}px`}
            padding="none"
            alignment="center middle"
            borderColor="#9494c8"
            onPress={() => handlePlayGame()}
          >
            <image
              url="lets-play.gif"
              description="Play game"
              height="100%"
              width="100%"
              imageHeight={cardSize}
              imageWidth={cardSize}
              resizeMode="cover"
            />
          </vstack>

          <vstack
            backgroundColor="#c6c6e1"
            cornerRadius="large"
            width={`${cardSize}px`}
            height={`${cardSize}px`}
            padding="none"
            alignment="center middle"
            borderColor="#9494c8"
            onPress={handleCreateGame}
          >
            <image
              url="lets-build.gif"
              description="Create game"
              height="100%"
              width="100%"
              imageHeight={cardSize}
              imageWidth={cardSize}
              resizeMode="cover"
            />
          </vstack>
        </hstack>
      )}

        <hstack width="100%" padding="small" alignment="center middle">
        <vstack
          darkBackgroundColor="#2d3142"
          lightBackgroundColor="#E8E5DA"
          cornerRadius="medium"
          width={`${2 * cardSize}px`}
          padding="medium"
          alignment="center middle"
          border="thin"
          darkBorderColor="#3d4252"
          lightBorderColor="#000000"
          onPress={handleHowToPlay}
        >
            <hstack gap="small" alignment="center middle">
              <text color="white" size="large">🤔</text>
              <ComicText size={isSmallScreen ? 0.16 : 0.20} color="#FF4500" bold>
                How to play?
              </ComicText>
            </hstack>
          </vstack>

      </hstack>
      <spacer size="medium" />
      </vstack>

      {/* Leaderboard Button - Top Right Overlay */}
      <hstack width="100%" height="100%" alignment="end top" padding="large">
        <vstack
          darkBackgroundColor="#2d3142"
          lightBackgroundColor="#E8E5DA"
          cornerRadius="medium"
          padding="medium"
          alignment="center middle"
          border="thin"
          darkBorderColor="#3d4252"
          lightBorderColor="#000000"
          onPress={async () => {
            try {
              if (context.postId) {
                await context.redis.hSet(`navState:${context.postId}`, {
                  page: 'leaderboard',
                });
              }
              
              // Mount the WebView first
              onMount();
              
              if (isWebViewReady) {
                postMessage({
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: 'leaderboard',
                  },
                });
              }
            } catch (error) {
              onMount();
              
              if (isWebViewReady) {
                postMessage({
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: 'leaderboard',
                  },
                });
              }
            }
          }}
        >
          <hstack gap="small" alignment="center middle">
            <vstack alignment="center middle">
              <text size="xlarge">🏆</text>
            </vstack>
            {!isSmallScreen && (
              <vstack alignment="center middle">
                <ComicText size={0.20} color="#FF4500" bold>
                  Leaderboard
                </ComicText>
              </vstack>
            )}
          </hstack>
        </vstack>
      </hstack>
    </zstack>
  );
};
