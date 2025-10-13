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
  useAsync(
    async () => {
      if (context.postId) {
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
        const currentUsername = await context.reddit.getCurrentUsername();
        if (currentUsername && currentUsername !== 'there') {
          return currentUsername;
        }

        // Increment retry count for next attempt
        return null;
      }
      return null;
    },
    {
      depends: [usernameRetryCount],
      finally: (result) => {
        if (result) {
          setUsername(result);
        } else if (username === 'there' && usernameRetryCount < 3) {
          setUsernameRetryCount((prev) => prev + 1);
        }
      },
    }
  );

  useAsync(
    async () => {
      // Skip if no valid gameId or username
      if (!previewData.gameId || !username || username === 'there') {
        return false;
      }

      const gameId = previewData.gameId;

      try {
        // Use the server-side function to check completion
        const result = await hasUserCompletedGame(
          { gameId: previewData.gameId, username: username },
          context
        );

        return result.completed;
      } catch (error) {
        return false;
      }
    },
    {
      depends: [refreshTrigger, previewData.gameId ?? null, username],
      finally: (result) => {
        const isCompleted = result === true;
        setHasCompletedGame(isCompleted);
      },
    }
  );

  // Load game data for this post
  useAsync(
    async () => {
      if (!context.postId) return null;

      // Get game ID from post relationship
      const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');

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
          setPreviewData(data);

          // Create letter boxes array from masked word
          if (data.maskedWord) {
            const boxes = data.maskedWord.split('').map((char) => {
              return char === '_' ? '' : char;
            });
            setLetterBoxes(boxes);
          }
        }
        setIsLoading(false);
      },
    }
  );

  const refreshCompletionStatus = async () => {
    if (!previewData?.gameId || !username || username === 'there') {
      return;
    }

    try {
      // First check: Look for game in completed games set
      const completedMember = await context.redis.zScore(
        `user:${username}:completedGames`,
        previewData.gameId
      );

      if (completedMember !== null) {
        setHasCompletedGame(true);
        return;
      }

      // Second check: Check game state's isCompleted flag
      const gameStateRaw = await context.redis.hGetAll(
        `gameState:${previewData.gameId}:${username}`
      );

      if (gameStateRaw && gameStateRaw.playerState) {
        const playerState = JSON.parse(gameStateRaw.playerState);
        if (playerState.isCompleted) {
          setHasCompletedGame(true);
          return;
        }
      }
      // If we get here, the game is not completed
      setHasCompletedGame(false);
    } catch (error) {
      // Default to not completed in case of error
      setHasCompletedGame(false);
    }
  };

  const sendNavigation = (page: Page, gameId?: string) => {

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
      // Only run if we actually have a pending navigation AND webview is ready
      if (!pendingNavigation || !isWebViewReady) {
        return null;
      }
      
      return {
        page: pendingNavigation.page,
        gameId: pendingNavigation.gameId ?? null,
      };
    },
    {
      depends: [
        isWebViewReady ? (pendingNavigation?.page ?? 'none') : 'waiting',
        isWebViewReady ? (pendingNavigation?.gameId ?? 'none') : 'waiting'
      ],
      finally: (data) => {
        if (data && typeof data === 'object' && 'page' in data && pendingNavigation) {
          // Send the navigation message
          const gameId = 'gameId' in data && data.gameId ? data.gameId as string : undefined;
          sendNavigation(data.page as Page, gameId);
          
          // Clear pending navigation to prevent duplicate sends
          setPendingNavigation(null);
        }
      },
    }
  );

  const storeGameId = async (gameId: string) => {
    if (context.postId) {
      await context.redis.hSet(`navState:${context.postId}`, {
        gameId,
        page: 'game',
      });
    }
  };

  const handlePlayGame = async () => {
    if (previewData.gameId) {
      await context.redis.del(`navState:${context.postId}`);
      await storeGameId(previewData.gameId);

      onMount();

      // Send navigation message
      sendNavigation('game', previewData.gameId);
    } else {
      context.ui.showToast('Game not found');
    }
  };

  const handleHowToPlay = async () => {
    await context.redis.del(`navState:${context.postId}`);

    if (context.postId) {
      await context.redis.hDel(`navState:${context.postId}`, ['page']);
      await context.redis.hDel(`navState:${context.postId}`, ['gameId']);
    }

    // Store new navigation state explicitly
    if (context.postId) {
      await context.redis.hSet(`navState:${context.postId}`, {
        page: 'howToPlay',
      });
    }

    onMount();

    sendNavigation('howToPlay');
  };

  const handleShowResults = async () => {
    await context.redis.del(`navState:${context.postId}`);

    if (context.postId) {
      await context.redis.hDel(`navState:${context.postId}`, ['page']);
      await context.redis.hDel(`navState:${context.postId}`, ['gameId']);
    }

    // Store new navigation state explicitly
    if (previewData.gameId) {
      if (context.postId) {
        await context.redis.hSet(`navState:${context.postId}`, {
          page: 'gameResults',
          gameId: previewData.gameId,
        });
      }

      onMount();
      sendNavigation('gameResults', previewData.gameId);
    } else {
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

  const firstGif = getFirstGif();

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
