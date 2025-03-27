import { Devvit, Context, useAsync, useState } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { BlocksToWebviewMessage } from '../../game/shared.js';
import { Page } from '../../game/lib/types.js';

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
}: GamePostPreviewProps) => {
  const [previewData, setPreviewData] = useState<{
    maskedWord?: string | null;
    gifs?: string[];
    gameId?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('there');
  const [gifLoaded, setGifLoaded] = useState(true); // Start with true since we can't track loading
  const [letterBoxes, setLetterBoxes] = useState<string[]>([]);
  const [pendingNavigation, setPendingNavigation] = useState<{ page: Page; gameId?: string } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(
    context.uiEnvironment?.colorScheme === "dark"
  );
  const [hasCompletedGame, setHasCompletedGame] = useState(false);
  

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

      if (currentUsername) {
        try {
          console.log(`🔍 [DEBUG-COMPLETION] Checking if ${currentUsername} has completed game ${gameId}`);
          
          // Method 1: Check user's completed games directly
          const score = await context.redis.zScore(`user:${currentUsername}:completedGames`, gameId);
          console.log(`🔍 [DEBUG-COMPLETION] zScore result:`, score);
          
          // Method 2: Check game state
          const gameState = await context.redis.hGetAll(`gameState:${gameId}:${currentUsername}`);
          console.log(`🔍 [DEBUG-COMPLETION] Game state:`, gameState);
          const stateCompleted = gameState?.isCompleted === 'true';
          
          // Use either method to determine completion
          const hasCompleted = score !== null || stateCompleted;
          console.log(`🔍 [DEBUG-COMPLETION] Game completion status:`, hasCompleted);
          setHasCompletedGame(hasCompleted);
        } catch (error) {
          console.error('Error checking game completion status:', error);
        }
      }

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

  const safePostMessage = (message: any) => {
    console.log('[DEBUG-NAV] GamePostPreview: Sending navigation message:', JSON.stringify(message));
    // @ts-ignore - Ignore TypeScript errors
    postMessage(message);
  };

  // Handle the case when WebView becomes ready and we have pending navigation
  if (isWebViewReady && pendingNavigation) {
    console.log('[DEBUG-NAV] GamePostPreview: WebView now ready, sending pending navigation to:', pendingNavigation.page);
    
    safePostMessage({
      type: 'NAVIGATE',
      data: {
        page: pendingNavigation.page,
        params: pendingNavigation.gameId ? { gameId: pendingNavigation.gameId } : {}
      }
    });
    
    // Clear pending navigation to prevent duplicate sends
    setPendingNavigation(null);
  }

  // Store game ID in Redis for persistence
  const storeGameId = async (gameId: string) => {
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] GamePostPreview: Storing gameId in Redis:', gameId);
        await context.redis.hSet(`navState:${context.postId}`, {
          gameId,
          page: 'game'
        });
      }
    } catch (error) {
      console.error('[DEBUG-NAV] GamePostPreview: Error storing gameId:', error);
    }
  };

  const handlePlayGame = () => {
    if (previewData.gameId) {
      console.log("[DEBUG-NAV] GamePostPreview: onPress handlePlayGame, gameId:", previewData.gameId);
      
      // Store the gameId in Redis for persistence
      storeGameId(previewData.gameId);
      
      // Mount the WebView
      onMount();
      
      if (isWebViewReady) {
        console.log('[DEBUG-NAV] GamePostPreview: WebView ready, sending navigation');
        safePostMessage({
          type: 'NAVIGATE',
          data: {
            page: 'game',
            params: { gameId: previewData.gameId }
          }
        });
      } else {
        console.log('[DEBUG-NAV] GamePostPreview: WebView not ready yet, storing pending navigation');
        setPendingNavigation({
          page: 'game',
          gameId: previewData.gameId
        });
      }
    } else {
      console.log("[DEBUG-NAV] GamePostPreview: Game not found");
      context.ui.showToast('Game not found');
    }
  };

  const handleHowToPlay = () => {
    console.log('[DEBUG-NAV] GamePostPreview: handleHowToPlay pressed');
    onMount();
    
    if (isWebViewReady) {
      safePostMessage({
        type: 'NAVIGATE',
        data: {
          page: 'howToPlay',
          params: {}
        }
      });
    } else {
      setPendingNavigation({
        page: 'howToPlay'
      });
    }
  };

  const handleShowResults = () => {
    console.log('[DEBUG-NAV] GamePostPreview: handleShowResults pressed');
    onMount();
    
    if (isWebViewReady) {
      safePostMessage({
        type: 'NAVIGATE',
        data: {
          page: 'leaderboard',
          params: { gameId: previewData.gameId }
        }
      });
    } else {
      setPendingNavigation({
        page: 'leaderboard',
        gameId: previewData.gameId
      });
    }
  };

  // Get the first GIF for the preview
  const getFirstGif = () => {
    if (previewData.gifs && previewData.gifs.length > 0) {
      return previewData.gifs[0];
    }
    return null;
  };

  if (isLoading) {
    return (
      <vstack height="100%" width="100%" alignment="center middle">
        <text style="heading" size="medium">
          Loading GIF Enigma...
        </text>
      </vstack>
    );
  }

  // If no game data was found, show an error
  if (!previewData.maskedWord || !previewData.gifs || previewData.gifs.length === 0) {
    return (
      <vstack height="100%" width="100%" alignment="center middle" padding="large" gap="medium">
        <text style="heading" size="medium">
          GIF Enigma
        </text>
        <text alignment="center">
          This game appears to be missing data. Try creating a new game instead.
        </text>
      </vstack>
    );
  }

  const firstGif = getFirstGif();

  return (
    <vstack height="100%" width="100%" backgroundColor="#0d1629" padding="small" darkBackgroundColor='#1A2740' lightBackgroundColor='#E8E5DA'>
      {/* Header */}
      <vstack alignment="center middle" padding="xsmall">
        <ComicText size={0.6} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {/* Main content area */}
      <vstack padding="small" gap="medium" grow alignment="center middle">
        {/* First GIF clue */}
        {firstGif && (
          <vstack
            backgroundColor="#1a2740"
            cornerRadius="large"
            padding="small"
            width="60%"
            alignment="center middle"
          >
            <vstack
              height={100}
              width="60%"
              backgroundColor="#0a1020"
              cornerRadius="medium"
              padding="xsmall"
              alignment="center middle"
            >
              <image
                url={firstGif}
                imageWidth={190}
                imageHeight={250}
                resizeMode="fit"
              />

              {!gifLoaded && (
                <text size="small" color="#ffffff" weight="bold">
                  Loading GIF...
                </text>
              )}
            </vstack>
          </vstack>
        )}
      </vstack>

      {/* Buttons based on game completion status */}
      <vstack padding="medium" alignment="center middle" gap="medium">
        {!hasCompletedGame ? (
          // User hasn't completed the game - show Solve It button
          <hstack
            cornerRadius="full"
            backgroundColor='#FF4500'
            padding="medium"
            onPress={handlePlayGame}
            alignment="center middle"
          >
            <text color='#FFFFFF' weight="bold">
              Solve It 🔍
            </text>
          </hstack>
        ) : (
          // User has completed the game - show How This Game Works and Show Results buttons
          <vstack gap="medium" alignment="center middle">
            <text color={isDarkMode ? '#FFFFFF' : '#0d1629'} weight="bold" alignment="center">
              You've solved this enigma!
            </text>
            <hstack gap="medium" alignment="center middle">
              <hstack
                cornerRadius="full"
                backgroundColor='#4267B2'
                padding="medium"
                onPress={handleHowToPlay}
                alignment="center middle"
              >
                <text color='#FFFFFF' weight="bold">
                  How This Game Works
                </text>
              </hstack>
              <hstack
                cornerRadius="full"
                backgroundColor='#FF4500'
                padding="medium"
                onPress={handleShowResults}
                alignment="center middle"
              >
                <text color='#FFFFFF' weight="bold">
                  Show Results
                </text>
              </hstack>
            </hstack>
          </vstack>
        )}
      </vstack>
    </vstack>
  );
};
