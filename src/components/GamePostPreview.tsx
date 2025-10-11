import { Devvit, Context, useAsync, useState } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { BlocksToWebviewMessage } from '../../game/shared.js';
import { Page } from '../../game/lib/types.js';
import { hasUserCompletedGame } from '../../game/server/gameHandler.js';

interface GamePostPreviewProps {
  context: Context;
  onMount: () => void;
  postMessage: (message: BlocksToWebviewMessage) => void;
  isWebViewReady: boolean;
  refreshTrigger: number;
}

export const GamePostPreview = ({
  context,
  onMount,
  postMessage,
  isWebViewReady,
  refreshTrigger,
}: GamePostPreviewProps) => {
  const [previewData, setPreviewData] = useState<{
    maskedWord?: string | null;
    gifs?: string[];
    gameId?: string;
  }>({});
  const [_isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('there');
  const [gifLoaded, _setGifLoaded] = useState(true); // Start with true since we can't track loading
  const [_letterBoxes, setLetterBoxes] = useState<string[]>([]);
  const [pendingNavigation, setPendingNavigation] = useState<{
    page: Page;
    gameId?: string;
  } | null>(null);
  const [_isDarkMode, setIsDarkMode] = useState(context.uiEnvironment?.colorScheme === 'dark');
  const [hasCompletedGame, setHasCompletedGame] = useState(false);
  const [_isWebViewMounted, setIsWebViewMounted] = useState(false);
  const [usernameRetryCount, setUsernameRetryCount] = useState(0);
  const isSmallScreen = (context.dimensions?.width ?? 0) < 420;
  // Add this useAsync block to reset state when postId changes
  useAsync(
    async () => {
      if (context.postId) {
        console.log('[DEBUG] Post ID changed, resetting preview state');
        setPreviewData({});
        setLetterBoxes([]);
        setHasCompletedGame(false);
        setUsername('there');
        setUsernameRetryCount(0);
      }
      return null;
    },
    {
      depends: [context.postId ?? ''],
    }
  );
  useAsync(
    async () => {
      // Only retry if username is still default and we haven't tried too many times
      if (username === 'there' && usernameRetryCount < 3) {
        console.log(
          `[DEBUG-USERNAME] Retrying username fetch (attempt ${usernameRetryCount + 1})...`
        );
        try {
          const currentUsername = await context.reddit.getCurrentUsername();
          if (currentUsername && currentUsername !== 'there') {
            return currentUsername;
          }
        } catch (error) {
          console.error(`[DEBUG-USERNAME] Retry ${usernameRetryCount + 1} failed:`, error);
        }

        // Increment retry count for next attempt
        return null;
      }
      return null;
    },
    {
      depends: [usernameRetryCount, username],
      finally: (result) => {
        if (result) {
          console.log('[DEBUG-USERNAME] Retry succeeded, setting username to:', result);
          setUsername(result);
        } else if (username === 'there' && usernameRetryCount < 3) {
          // Schedule another retry
          console.log('[DEBUG-USERNAME] Scheduling another retry...');
          setUsernameRetryCount((prev) => prev + 1);
        }
      },
    }
  );

  // Fix the completion check logic in your useAsync
  // Check completion status - runs when refreshTrigger changes
  useAsync(
    async () => {
      // Skip if no valid gameId or username
      if (!previewData.gameId || !username || username === 'there') {
        console.log('🔍 [DEBUG-COMPLETION] Missing valid data, cannot check completion');
        return false;
      }

      const gameId = previewData.gameId;
      console.log(
        `🔄 [DEBUG-COMPLETION] Checking completion for game: ${gameId}, user: ${username}, refresh: ${refreshTrigger}`
      );

      try {
        // Use the server-side function to check completion
        const result = await hasUserCompletedGame(
          { gameId: previewData.gameId, username: username },
          context
        );

        console.log(`[DEBUG-COMPLETION] Server response for completion check:`, result);
        return result.completed;
      } catch (error) {
        console.error(`[DEBUG-COMPLETION] Error checking completion:`, error);
        return false;
      }
    },
    {
      depends: [refreshTrigger, previewData.gameId ?? null, username],
      finally: (result) => {
        const isCompleted = result === true;
        console.log(`🔄 [DEBUG-COMPLETION] Setting hasCompletedGame to: ${isCompleted}`);
        setHasCompletedGame(isCompleted);
      },
    }
  );

  // Load game data for this post
  useAsync(
    async () => {
      if (!context.postId) return null;

      // Try to get username
      let currentUsername;
      try {
        currentUsername = await context.reddit.getCurrentUsername();
        if (currentUsername) {
          setUsername(currentUsername);
        }
      } catch (userError) {
        console.error('Error getting username:', userError);
      }

      // Get game ID from post relationship
      const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
      console.log('GamePostPreview: Found game ID:', gameId);

      if (!gameId) return null;

      // Try to get preview data first
      const previewData = await context.redis.hGetAll(`gamePreview:${gameId}`);

      const redditPostId = context.postId;

      if (previewData && previewData.maskedWord) {
        return {
          maskedWord: previewData.maskedWord || '',
          gifs: JSON.parse(previewData.gifs || '[]'),
          gameId: gameId,
          redditPostId,
        };
      }

      // Fallback to game data
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      if (gameData && gameData.maskedWord) {
        return {
          maskedWord: gameData.maskedWord || '',
          gifs: JSON.parse(gameData.gifs || '[]'),
          gameId: gameId,
          redditPostId,
        };
      }

      return null;
    },
    {
      depends: [context.postId ?? ''],
      finally: (data, error) => {
        if (data && !error) {
          console.log('GamePostPreview: Loaded preview data:', data);
          setPreviewData(data);

          // Create letter boxes array from masked word
          if (data.maskedWord) {
            const boxes = data.maskedWord.split('').map((char) => {
              return char === '_' ? '' : char;
            });
            setLetterBoxes(boxes);
          }
        }

        if (error) {
          console.error('Error loading game preview:', error);
        }

        setIsLoading(false);
      },
    }
  );

  const refreshCompletionStatus = async () => {
    if (!previewData?.gameId || !username || username === 'there') {
      console.log('[DEBUG-REFRESH] Cannot refresh completion status - missing data');
      return;
    }

    console.log(
      `[DEBUG-REFRESH] Forcing refresh of completion status for game ${previewData.gameId}`
    );

    try {
      // First check: Look for game in completed games set
      const completedMember = await context.redis.zScore(
        `user:${username}:completedGames`,
        previewData.gameId
      );

      if (completedMember !== null) {
        console.log(`[DEBUG-REFRESH] Game found in completed set with score: ${completedMember}`);
        setHasCompletedGame(true);
        return;
      }

      // Second check: Check game state's isCompleted flag
      const gameStateRaw = await context.redis.hGetAll(
        `gameState:${previewData.gameId}:${username}`
      );

      if (gameStateRaw && gameStateRaw.playerState) {
        try {
          const playerState = JSON.parse(gameStateRaw.playerState);
          if (playerState.isCompleted) {
            console.log(`[DEBUG-REFRESH] Game marked as completed in playerState`);
            setHasCompletedGame(true);
            return;
          }
        } catch (parseError) {
          console.error(`[DEBUG-REFRESH] Error parsing playerState: ${parseError}`);
        }
      }

      // If we get here, the game is not completed
      console.log(`[DEBUG-REFRESH] Game ${previewData.gameId} is NOT completed`);
      setHasCompletedGame(false);
    } catch (error) {
      console.error(`[DEBUG-REFRESH] Error refreshing completion status: ${error}`);
      // Default to not completed in case of error
      setHasCompletedGame(false);
    }
  };

  useAsync(
    async () => {
      if (previewData.gameId && username && username !== 'there') {
        await refreshCompletionStatus();
        return true;
      }
      return false;
    },
    {
      depends: [previewData.gameId ?? null, username, refreshTrigger],
    }
  );

  const sendNavigation = (page: Page, gameId?: string) => {
    console.log('[DEBUG-NAV] GamePostPreview: Sending navigation message:', page, gameId);

    postMessage({
      type: 'NAVIGATE',
      data: {
        page: page,
        params: gameId ? { gameId } : undefined,
      },
    });
  };

  useAsync(
    async () => {
      if (isWebViewReady && pendingNavigation) {
        console.log(
          '[DEBUG-NAV] GamePostPreview: WebView now ready, sending pending navigation to:',
          pendingNavigation.page
        );

        setPendingNavigation(null);

        // Send the navigation message
        sendNavigation(pendingNavigation.page, pendingNavigation.gameId);

        // Clear pending navigation to prevent duplicate sends
        setPendingNavigation(null);
        return true;
      }
      return false;
    },
    {
      depends: [isWebViewReady, pendingNavigation],
    }
  );

  const storeGameId = async (gameId: string) => {
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] GamePostPreview: Storing gameId in Redis:', gameId);
        await context.redis.hSet(`navState:${context.postId}`, {
          gameId,
          page: 'game',
        });
      }
    } catch (error) {
      console.error('[DEBUG-NAV] GamePostPreview: Error storing gameId:', error);
    }
  };

  const handlePlayGame = async () => {
    if (previewData.gameId) {
      await context.redis.del(`navState:${context.postId}`);
      console.log(
        '[DEBUG-NAV] GamePostPreview: handlePlayGame pressed, navigating to game page with gameId:',
        previewData.gameId
      );

      await storeGameId(previewData.gameId);

      onMount();

      // Send navigation message
      sendNavigation('game', previewData.gameId);
    } else {
      console.log('[DEBUG-NAV] GamePostPreview: Game not found');
      context.ui.showToast('Game not found');
    }
  };

  const handleHowToPlay = async () => {
    await context.redis.del(`navState:${context.postId}`);
    console.log(
      '[DEBUG-NAV] GamePostPreview: handleHowToPlay pressed, navigating to howToPlay page'
    );

    // CRITICAL FIX: Clear any stored navigation state for this post first
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] GamePostPreview: Clearing previous navigation state');
        await context.redis.hDel(`navState:${context.postId}`, ['page']);
        await context.redis.hDel(`navState:${context.postId}`, ['gameId']);
      }
    } catch (error) {
      console.error('[DEBUG-NAV] Error clearing navigation state:', error);
    }

    // Store new navigation state explicitly
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] GamePostPreview: Storing howToPlay in navigation state');
        await context.redis.hSet(`navState:${context.postId}`, {
          page: 'howToPlay',
        });
      }
    } catch (error) {
      console.error('[DEBUG-NAV] Error storing navigation state:', error);
    }

    onMount();

    sendNavigation('howToPlay');
  };

  const handleShowResults = async () => {
    await context.redis.del(`navState:${context.postId}`);
    console.log(
      '[DEBUG-NAV] GamePostPreview: handleShowResults pressed, navigating to gameResults page'
    );

    // CRITICAL FIX: Clear any stored navigation state for this post first
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] GamePostPreview: Clearing previous navigation state');
        await context.redis.hDel(`navState:${context.postId}`, ['page']);
        await context.redis.hDel(`navState:${context.postId}`, ['gameId']);
      }
    } catch (error) {
      console.error('[DEBUG-NAV] Error clearing navigation state:', error);
    }

    // Store new navigation state explicitly
    if (previewData.gameId) {
      try {
        if (context.postId) {
          console.log('[DEBUG-NAV] GamePostPreview: Storing gameResults in navigation state');
          await context.redis.hSet(`navState:${context.postId}`, {
            page: 'gameResults',
            gameId: previewData.gameId,
          });
        }
      } catch (error) {
        console.error('[DEBUG-NAV] Error storing navigation state:', error);
      }

      onMount();
      sendNavigation('gameResults', previewData.gameId);
    } else {
      console.log('[DEBUG-NAV] GamePostPreview: Game not found for gameResults');
      context.ui.showToast('Game not found');
    }
  };

  // Get the first GIF for the preview
  const getFirstGif = () => {
    if (previewData.gifs && previewData.gifs.length > 0) {
      return previewData.gifs[0];
    }
    return null;
  };

  // if (isLoading) {
  //   return (
  //     <vstack height="100%" width="100%" alignment="center middle">
  //       <vstack alignment="center middle">
  //         <image 
  //           url="loading.gif"
  //           imageWidth={50}
  //           imageHeight={50}
  //         />
  //       </vstack>
  //     </vstack>
  //   );
  // }

  // // If no game data was found, show an error
  // if (!previewData.maskedWord || !previewData.gifs || previewData.gifs.length === 0) {
  //   return (
  //     <vstack height="100%" width="100%" alignment="center middle" padding="large" gap="medium">
  //       <text style="heading" size="medium">
  //         GIF Enigma
  //       </text>
  //       <text alignment="center">
  //         This game appears to be missing data. Try creating a new game instead.
  //       </text>
  //     </vstack>
  //   );
  // }

  const firstGif = getFirstGif();

  if (previewData.gameId && username) {
    // Log the actual value from state
    console.log(`[DEBUG-FORCE] Original hasCompletedGame: ${hasCompletedGame}`);
  }

  return (
    <vstack
      height="100%"
      width="100%"
      backgroundColor="#0d1629"
      padding="small"
      darkBackgroundColor="#1A2740"
      lightBackgroundColor="#E8E5DA"
    >
      {/* Header */}
      <vstack alignment="center middle" padding="xsmall">
        <ComicText size={isSmallScreen ? 0.5 : 0.6} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {/* Main content area */}
      <vstack width="100%" padding="small" gap="small" grow alignment="center middle">
        {/* First GIF clue */}
        {firstGif && (
          <vstack
            height={100}
            width="80%"
            backgroundColor="#0a1020"
            cornerRadius="large"
            padding="xsmall"
            alignment="center middle"
          >
            <image url={firstGif} imageWidth={250} imageHeight={300} resizeMode="fit" />

            {!gifLoaded && (
              <text size="small" color="#ffffff" weight="bold">
                Loading GIF...
              </text>
            )}
          </vstack>
        )}
      </vstack>

      <vstack padding="medium" alignment="center middle" gap="medium">
        {hasCompletedGame === false ? (
          <hstack gap="medium" alignment="center middle">
            <hstack
              cornerRadius="full"
              backgroundColor="#FF4500"
              padding="medium"
              onPress={handlePlayGame}
              alignment="center middle"
            >
              <vstack alignment="center middle">
                <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                  Decode the GIF  
                </ComicText>
              </vstack>
              <vstack alignment="center middle">
                <text color="white" size="large">🔍</text>
              </vstack>
            </hstack>
            <hstack
              cornerRadius="full"
              backgroundColor="#4267B2"
              padding="medium"
              onPress={handleHowToPlay}
              alignment="center middle"
            >
              <vstack alignment="center middle">
              <spacer size="xsmall" />
                <ComicText size={isSmallScreen ? 0.13 : 0.14} color="white" bold>
                  How To Play?  
                </ComicText>
              </vstack>
              <vstack alignment="center middle">
                <text color="white" size="large">🤔</text>
              </vstack>
            </hstack>
          </hstack>
        ) : (
          // User has completed the game - show How This Game Works and Show Results buttons
          <vstack gap="medium" alignment="center middle">
            <hstack gap="medium" alignment="center middle">
              <hstack
                cornerRadius="full"
                backgroundColor="#4267B2"
                padding="medium"
                onPress={handleHowToPlay}
                alignment="center middle"
              >
                <vstack alignment="center middle">
                <spacer size="xsmall" />
                  <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                    How To Play?  
                  </ComicText>
                </vstack>
                <vstack alignment="center middle">
                  <text color="white" size="large">🤔</text>
                </vstack>
              </hstack>
              <hstack
                cornerRadius="full"
                backgroundColor="#FF4500"
                padding="medium"
                onPress={handleShowResults}
                alignment="center middle"
              >
                <vstack alignment="center middle">
                  <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                    View Results  
                  </ComicText>
                </vstack>
                <vstack alignment="center middle">
                  <text color="white" size="large">📊</text>
                </vstack>
              </hstack>
            </hstack>
          </vstack>
        )}
      </vstack>
    </vstack>
  );
};
