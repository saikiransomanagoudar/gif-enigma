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

  const handlePlayGame = async () => {
    // Global debouncing
    const now = Date.now();
    if (now - lastClickTime < DEBOUNCE_MS) {
      return;
    }
    lastClickTime = now;
    
    // Prevent multiple simultaneous calls
    if (isSearching) {
      return;
    }
    
    setIsSearching(true);

    try {
      // Helper function to check if a game has been completed by the user
      const isGameCompleted = async (gameId: string): Promise<boolean> => {        
        // Check 1: completedGames sorted set
        const completedGamesResult = await context.redis.zRange(
          `user:${username}:completedGames`, 
          0, 
          -1, 
          { by: 'score' }
        );
        
        const completedGameIds = completedGamesResult.map((item: any) =>
          typeof item === 'string' ? item : item.member
        );
        
        
        if (completedGameIds.includes(gameId)) {
          return true;
        }
        
        // Check 2: gameState for completion flags
        const gameState = await context.redis.hGetAll(`gameState:${username}:${gameId}`);
        
        if (gameState && gameState.playerState) {
          try {
            const parsedState = JSON.parse(gameState.playerState);
            
            if (parsedState.isCompleted || parsedState.hasGivenUp || parsedState.isCreator) {
              return true;
            }
          } catch (e) {
          }
        }
        
        // Check 3: Look for a saved score (legacy completions before tracking was added)
        const scoreData = await context.redis.hGetAll(`score:${gameId}:${username}`);
        if (scoreData && Object.keys(scoreData).length > 0) {
          // Add to completedGames list for future checks
          await context.redis.zAdd(`user:${username}:completedGames`, {
            member: gameId,
            score: Date.now(),
          });
          return true;
        }
        
        return false;
      };

      // Check if user has a "sticky" assigned game
      const assignedGameKey = `user:${username}:assignedGame`;
      const assignedGameId = await context.redis.get(assignedGameKey);
            
      // If there's an assigned game, verify it's still valid and unplayed
      if (assignedGameId) {
        // Check if user has already completed this game
        const isCompleted = await isGameCompleted(assignedGameId);
        
        if (isCompleted) {
          await context.redis.del(assignedGameKey);
        } else {
          // Check if game is still valid
          const gameData = await context.redis.hGetAll(`game:${assignedGameId}`);
          
          if (gameData && gameData.redditPostId && gameData.word && gameData.gifs && gameData.isRemoved !== 'true') {
            // Game is still valid and unplayed! Navigate to it
            try {
              const post = await context.reddit.getPostById(gameData.redditPostId);
              
              if (post && !post.removed) {
                
                setIsSearching(false);
                context.ui.showToast({
                  text: '🎮 Your game is ready!',
                  appearance: 'success',
                });
                
                if (post.url) {
                  context.ui.navigateTo(post.url);
                } else if (post.permalink) {
                  context.ui.navigateTo(`https://www.reddit.com${post.permalink}`);
                }
                return;
              } else {
                // Post was deleted/removed - clear assignment
                await context.redis.del(assignedGameKey);
              }
            } catch (error) {
              // Error fetching post - clear assignment
              await context.redis.del(assignedGameKey);
            }
          } else {
            // Game data invalid - clear assignment
            await context.redis.del(assignedGameKey);
          }
        }
      }
      
      // Get completed games list for filtering
      const completedGamesResult = await context.redis.zRange(
        `user:${username}:completedGames`, 
        0, 
        -1, 
        { by: 'score' }
      );
      
      const completedGameIds = completedGamesResult.map((item: any) =>
        typeof item === 'string' ? item : item.member
      );

      // Get all active games from Redis
      let allGamesResult = await context.redis.zRange(
        'activeGames', 
        0, 
        -1, 
        { by: 'score' }
      );

      // Fallback: If Redis is empty, try to find games from Reddit posts
      if (!allGamesResult || allGamesResult.length === 0) {
        
        const subreddit = await context.reddit.getCurrentSubreddit();
        const listing = await context.reddit.getNewPosts({
          subredditName: subreddit.name,
          limit: 100,
          pageSize: 100,
        });
        const posts = await listing.all();
        
        // Build game list from posts
        const gameIds = [];
        for (const post of posts) {
          const postData = await context.redis.hGetAll(`post:${post.id}`);
          if (postData && postData.gameId) {
            gameIds.push(postData.gameId);
          }
        }
        
        allGamesResult = gameIds.map((id: string) => ({ member: id, score: 0 }));
      }

      if (!allGamesResult || allGamesResult.length === 0) {
        setIsSearching(false);
        context.ui.showToast('🎨 No games yet! Click "Let\'s Build" to create the first game.');
        return;
      }

      // Filter to unplayed games
      const unplayedGameIds = allGamesResult
        .map((item: any) => typeof item === 'string' ? item : item.member)
        .filter((gameId: string) => !completedGameIds.includes(gameId));

      if (unplayedGameIds.length === 0) {
        setIsSearching(false);
        context.ui.showToast('🎉 Amazing! You\'ve played all available games! Check back later for new ones.');
        return;
      }

      // Randomly pick one unplayed game and validate it
      const MAX_ATTEMPTS = Math.min(20, unplayedGameIds.length);
      
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const randomIndex = Math.floor(Math.random() * unplayedGameIds.length);
        const randomGameId = unplayedGameIds[randomIndex];
                
        // Use the helper function to thoroughly check if game is completed
        const isCompleted = await isGameCompleted(randomGameId);
        
        if (isCompleted) {
          unplayedGameIds.splice(randomIndex, 1);
          
          if (unplayedGameIds.length === 0) {
            break;
          }
          continue;
        }
        
        const gameData = await context.redis.hGetAll(`game:${randomGameId}`);
        
        // Validate game data
        if (!gameData || !gameData.redditPostId || !gameData.word || gameData.isRemoved === 'true') {
          unplayedGameIds.splice(randomIndex, 1);
          
          if (unplayedGameIds.length === 0) {
            break;
          }
          continue;
        }
        
        // Validate GIFs
        try {
          const gifs = JSON.parse(gameData.gifs);
          if (!Array.isArray(gifs) || gifs.length === 0) {
            unplayedGameIds.splice(randomIndex, 1);
            
            if (unplayedGameIds.length === 0) {
              break;
            }
            continue;
          }
        } catch (e) {
          unplayedGameIds.splice(randomIndex, 1);
          
          if (unplayedGameIds.length === 0) {
            break;
          }
          continue;
        }
        
        // Verify Reddit post exists
        try {
          const post = await context.reddit.getPostById(gameData.redditPostId);
          
          if (post && !post.removed) {
            await context.redis.set(assignedGameKey, randomGameId);
            setIsSearching(false);
            context.ui.showToast({
              text: '🎮 Game found!',
              appearance: 'success',
            });
            
            // Navigate to the game
            if (post.url) {
              context.ui.navigateTo(post.url);
            } else if (post.permalink) {
              context.ui.navigateTo(`https://www.reddit.com${post.permalink}`);
            }
            return;
          } else {
            // Post removed - mark and try another
            await context.redis.hSet(`game:${randomGameId}`, { isRemoved: 'true' });
            unplayedGameIds.splice(randomIndex, 1);
            
            if (unplayedGameIds.length === 0) {
              break;
            }
            continue;
          }
        } catch (error) {
          await context.redis.hSet(`game:${randomGameId}`, { isRemoved: 'true' });
          unplayedGameIds.splice(randomIndex, 1);
          
          if (unplayedGameIds.length === 0) {
            break;
          }
          continue;
        }
      }

      // Couldn't find valid game after attempts
      setIsSearching(false);
      context.ui.showToast('Could not find a valid game. Please try again or create a new one!');
      
    } catch (error) {
      setIsSearching(false);
      const errorMessage = error instanceof Error 
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
