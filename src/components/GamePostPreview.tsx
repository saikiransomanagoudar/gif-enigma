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
  // State to trigger navigation
  const [navigationRequest, setNavigationRequest] = useState<{
    page: string;
    gameId?: string;
  } | null>(null);

  // Handle navigation with useAsync to avoid ServerCallRequired error
  useAsync(async () => {
    if (!navigationRequest) return null;
    
    const { page, gameId } = navigationRequest;
    
    // Clear nav state
    await context.redis.del(`navState:${context.postId}`);
    if (context.postId) {
      await context.redis.hDel(`navState:${context.postId}`, ['page']);
      await context.redis.hDel(`navState:${context.postId}`, ['gameId']);
      
      const navData: any = { page };
      if (gameId) {
        navData.gameId = gameId;
      }
      await context.redis.hSet(`navState:${context.postId}`, navData);
    }
    
    onMount();
    if (isWebViewReady) {
      const messageData: any = { page };
      if (gameId) {
        messageData.gameId = gameId;
      }
      postMessage({
        type: 'NAVIGATE',
        data: messageData,
      });
    }
    
    // Reset navigation request
    setNavigationRequest(null);
    return null;
  }, { depends: [navigationRequest] });

  // Memoize dimensions to prevent recalculation
  const screenWidth = context.dimensions?.width || 0;
  const isSmallScreen = screenWidth < 420;
  const isVeryNarrow = screenWidth < 350; // Only for screens narrower than OnePlus 7T (358px)
  const cardSize = isSmallScreen
    ? Math.floor((screenWidth || 320) * 0.4)
    : Math.floor((screenWidth || 800) * 0.25);

  // console.log(`GamePostPreview - screenWidth: ${screenWidth}, isVeryNarrow: ${isVeryNarrow}`);
  
  // Load data with refreshTrigger dependency to support reloading when game is created
  const { data: gameData, loading: isLoading } = useAsync(
    async () => {
      // Don't proceed if no postId
      if (!context.postId) {
        return null;
      }

      try {
        // Get username
        const currentUsername = await context.reddit.getCurrentUsername();
        const username = currentUsername || 'anonymous';

        // Get game ID with enhanced retry logic for newly created posts (especially for mobile)
        let gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
        
        // Enhanced retry logic with multiple attempts for mobile compatibility
        let retryCount = 0;
        const maxRetries = 5;
        while (!gameId && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1))); // Increasing delay
          gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
          retryCount++;
        }
        
        if (!gameId) {
          console.error(`GamePostPreview: No gameId found for post ${context.postId} after ${maxRetries} retries`);
          return null;
        }

        // Try to get preview data first, then fallback to game data with retry
        let previewData = null;
        let previewDataRaw = await context.redis.hGetAll(`gamePreview:${gameId}`);

        // Retry for preview data if not found (mobile timing issue)
        if (!previewDataRaw || !previewDataRaw.maskedWord) {
          await new Promise(resolve => setTimeout(resolve, 500));
          previewDataRaw = await context.redis.hGetAll(`gamePreview:${gameId}`);
        }

        if (previewDataRaw && previewDataRaw.maskedWord) {
          previewData = {
            maskedWord: previewDataRaw.maskedWord || '',
            gifs: JSON.parse(previewDataRaw.gifs || '[]'),
            gameId: gameId,
            redditPostId: context.postId,
          };
        } else {
          // Fallback to game data
          const gameDataRaw = await context.redis.hGetAll(`game:${gameId}`);
          
          if (gameDataRaw && gameDataRaw.maskedWord) {
            previewData = {
              maskedWord: gameDataRaw.maskedWord || '',
              gifs: JSON.parse(gameDataRaw.gifs || '[]'),
              gameId: gameId,
              redditPostId: context.postId,
            };
          }
        }

        if (!previewData) {
          console.error(`GamePostPreview: No preview data found for game ${gameId}`);
          return null;
        }

        // Check completion status only if we have preview data
        let hasCompletedGame = false;
        if (username !== 'anonymous') {
          try {
            const result = await hasUserCompletedGame(
              { gameId: previewData.gameId, username: username },
              context
            );
            hasCompletedGame = result.completed === true;
          } catch (error) {
            hasCompletedGame = false;
          }
        }

        return { username, previewData, hasCompletedGame };
      } catch (error) {
        console.error('GamePostPreview: Error loading game preview:', error);
        return null;
      }
    },
    {
      // Include refreshTrigger to allow reloading when game is created
      depends: [context.postId || '', refreshTrigger],
    }
  );

    // Early return for loading state
  if (isLoading || !gameData) {
    return (
      <vstack
        height="100%"
        width="100%"
        backgroundColor="#0d1629"
        darkBackgroundColor="#1A2740"
        lightBackgroundColor="#E8E5DA"
        alignment="center middle"
      >
        <vstack alignment="center middle" gap="medium">
          <image
            url="eyebrows.gif"
            description="Loading game..."
            imageHeight={cardSize}
            imageWidth={cardSize}
            resizeMode="fit"
          />
        </vstack>
      </vstack>
    );
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
      <vstack alignment="center middle">
        <spacer size="medium" />
        <ComicText size={isSmallScreen ? 0.5 : 0.6} color="#FF4500">
          GIF Enigma
        </ComicText>
        <spacer size="xsmall" />
      </vstack>

      {/* Main content area */}
      <vstack width="100%" padding="small" gap="small" grow alignment="center middle">
        {/* First GIF clue - TV Screen Style */}
        {gameData.previewData?.gifs?.[0] && (
          <vstack
            backgroundColor="#0a1020"
            cornerRadius="medium"
            padding="medium"
            alignment="center middle"
            border="thick"
            borderColor="#1a2030"
            maxWidth={isSmallScreen ? "90%" : "450px"}
          >
            <image 
              url={gameData.previewData.gifs[0]} 
              imageWidth={isSmallScreen ? Math.min(screenWidth * 0.7, 340) : 320}
              imageHeight={isSmallScreen ? Math.min(screenWidth * 0.7, 340) : 240}
              resizeMode="fit" 
            />
          </vstack>
        )}
      </vstack>

      <vstack padding="medium" alignment="center middle" gap="medium">
        {gameData.hasCompletedGame === false ? (
          isVeryNarrow ? (
            // Vertical layout for very narrow screens (Galaxy S8+)
            <vstack gap="small" alignment="center middle">
              <hstack
                cornerRadius="full"
                backgroundColor="#FF4500"
                padding="medium"
                onPress={() => {
                  if (gameData.previewData?.gameId) {
                    setNavigationRequest({
                      page: 'game',
                      gameId: gameData.previewData.gameId,
                    });
                  } else {
                    context.ui.showToast('Game not found');
                  }
                }}
                alignment="center middle"
              >
                <text color="white" size="large">🔍</text>
                <spacer size="xsmall" />
                <ComicText size={0.14} color="white" bold>
                  Decode the GIF  
                </ComicText>
              </hstack>
              <hstack
                cornerRadius="full"
                backgroundColor="#4267B2"
                padding="medium"
                onPress={() => {
                  setNavigationRequest({ page: 'howToPlay' });
                }}
                alignment="center middle"
              >
                <text color="white" size="large">🤔</text>
                <spacer size="xsmall" />
                <ComicText size={0.14} color="white" bold>
                  How to play?  
                </ComicText>
              </hstack>
            </vstack>
          ) : (
            // Horizontal layout for wider screens
            <hstack gap="medium" alignment="center middle">
              <zstack alignment="center middle">
                <hstack
                  cornerRadius="full"
                  backgroundColor="#FF4500"
                  padding="medium"
                  onPress={() => {
                    if (gameData.previewData?.gameId) {
                      setNavigationRequest({
                        page: 'game',
                        gameId: gameData.previewData.gameId,
                      });
                    } else {
                      context.ui.showToast('Game not found');
                    }
                  }}
                  alignment="center middle"
                >
                  <text color="white" size="large">🔍</text>
                  <spacer size="xsmall" />
                  <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                    Decode the GIF  
                  </ComicText>
                </hstack>
              </zstack>
              <hstack
                cornerRadius="full"
                backgroundColor="#4267B2"
                padding="medium"
                onPress={() => {
                  setNavigationRequest({ page: 'howToPlay' });
                }}
                alignment="center middle"
              >
                <text color="white" size="large">🤔</text>
                <spacer size="xsmall" />
                <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                  How to play?  
                </ComicText>
              </hstack>
            </hstack>
          )
        ) : (
          // User has completed the game - show How This Game Works and Show Results buttons
          <vstack gap="medium" alignment="center middle">
            {isVeryNarrow ? (
              // Vertical layout for very narrow screens
              <vstack gap="small" alignment="center middle">
                <hstack
                  cornerRadius="full"
                  backgroundColor="#FF4500"
                  padding="medium"
                  onPress={() => {
                    if (gameData.previewData?.gameId) {
                      setNavigationRequest({
                        page: 'gameResults',
                        gameId: gameData.previewData.gameId,
                      });
                    } else {
                      context.ui.showToast('Game not found');
                    }
                  }}
                  alignment="center middle"
                >
                  <text color="white" size="large">📊</text>
                  <spacer size="xsmall" />
                  <ComicText size={0.145} color="white" bold>
                    View results  
                  </ComicText>
                </hstack>
                <hstack
                  cornerRadius="full"
                  backgroundColor="#4267B2"
                  padding="medium"
                  onPress={() => {
                    setNavigationRequest({ page: 'howToPlay' });
                  }}
                  alignment="center middle"
                >
                  <text color="white" size="large">🤔</text>
                  <spacer size="xsmall" />
                  <ComicText size={0.14} color="white" bold>
                    How to play?  
                  </ComicText>
                </hstack>
              </vstack>
            ) : (
              // Horizontal layout for wider screens
              <hstack gap="medium" alignment="center middle">
                <hstack
                  cornerRadius="full"
                  backgroundColor="#FF4500"
                  padding="medium"
                  onPress={() => {
                    if (gameData.previewData?.gameId) {
                      setNavigationRequest({
                        page: 'gameResults',
                        gameId: gameData.previewData.gameId,
                      });
                    } else {
                      context.ui.showToast('Game not found');
                    }
                  }}
                  alignment="center middle"
                >
                  <text color="white" size="large">📊</text>
                  <spacer size="xsmall" />
                  <ComicText size={isSmallScreen ? 0.145 : 0.155} color="white" bold>
                    View results  
                  </ComicText>
                </hstack>
                <hstack
                  cornerRadius="full"
                  backgroundColor="#4267B2"
                  padding="medium"
                  onPress={() => {
                    setNavigationRequest({ page: 'howToPlay' });
                  }}
                  alignment="center middle"
                >
                  <text color="white" size="large">🤔</text>
                  <spacer size="xsmall" />
                  <ComicText size={isSmallScreen ? 0.14 : 0.15} color="white" bold>
                    How to play?  
                  </ComicText>
                </hstack>
              </hstack>
            )}
          </vstack>
        )}
      </vstack>
    </vstack>
  );
};
