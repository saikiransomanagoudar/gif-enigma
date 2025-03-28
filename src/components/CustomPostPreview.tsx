import { Devvit, Context, useState, useAsync } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { Page } from '../../game/lib/types.js';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../../game/shared.js';

interface CustomPostPreviewProps {
  context: Context;
  onMount: () => void;
  postMessage: (message: BlocksToWebviewMessage) => void;
  isWebViewReady: boolean;
}

export const CustomPostPreview = ({
  context,
  onMount,
  postMessage,
  isWebViewReady,
}: CustomPostPreviewProps) => {
  const [previewData, setPreviewData] = useState<{
    maskedWord?: string;
    gifs?: string[];
    gameId?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('there');
  const [gifUrls, setGifUrls] = useState<{
    startGif: string | null;
  }>({
    startGif: null,
  });
  const [pendingNavigation, setPendingNavigation] = useState<{
    page: Page;
    gameId?: string;
  } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(context.uiEnvironment?.colorScheme === 'dark');

  useAsync(
    async () => {
      // Get asset URLs
      const startGifUrl = context.assets.getURL('eyebrows.gif');

      // Get username efficiently
      const currentUsername = (await context.reddit.getCurrentUsername()) || '';

      // Return all data together
      return {
        startGifUrl: startGifUrl,
        currentUsername: currentUsername,
      };
    },
    {
      // Use the finally callback for state updates
      finally: (data, error) => {
        if (data && !error) {
          // Update state with the fetched data
          setGifUrls({
            startGif: data.startGifUrl,
          });

          if (data.currentUsername) {
            setUsername(data.currentUsername);
          }
        }

        if (error) {
          console.error('Error fetching assets or username:', error);
        }
      },
    }
  );

  // useAsync(
  //   async () => {
  //     if (!context.postId) return null;

  //     // Get game ID from post relationship
  //     const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
  //     if (!gameId) return null;

  //     // Try to get preview data first
  //     const previewData = await context.redis.hGetAll(`gamePreview:${gameId}`);

  //     if (previewData && previewData.maskedWord) {
  //       return {
  //         maskedWord: previewData.maskedWord,
  //         gifs: JSON.parse(previewData.gifs || '[]'),
  //         gameId: gameId,
  //       };
  //     }

  //     // Fallback to game data
  //     const gameData = await context.redis.hGetAll(`game:${gameId}`);
  //     if (gameData && gameData.maskedWord) {
  //       return {
  //         maskedWord: gameData.maskedWord,
  //         gifs: JSON.parse(gameData.gifs || '[]'),
  //         gameId: gameId,
  //       };
  //     }

  //     return null;
  //   },
  //   {
  //     depends: [context.postId ?? ''],
  //     finally: (data, error) => {
  //       if (data && !error) {
  //         setPreviewData(data);
  //       }

  //       if (error) {
  //         console.error('Error loading game preview:', error);
  //       }

  //       setIsLoading(false);
  //     },
  //   }
  // );

  // //  Helper function to send navigation messages
  // const safePostMessage = (message: any) => {
  //   console.log(
  //     '[DEBUG-NAV] CustomPostPreview: Sending navigation message:',
  //     JSON.stringify(message)
  //   );
  //   // @ts-ignore - Ignore TypeScript errors
  //   postMessage(message);
  // };

  // // Handle the case when WebView becomes ready and we have pending navigation
  // if (isWebViewReady && pendingNavigation) {
  //   console.log(
  //     '[DEBUG-NAV] CustomPostPreview: WebView now ready, sending pending navigation to:',
  //     pendingNavigation.page
  //   );

  //   safePostMessage({
  //     type: 'NAVIGATE',
  //     data: {
  //       page: pendingNavigation.page,
  //       params: pendingNavigation.gameId ? { gameId: pendingNavigation.gameId } : {},
  //     },
  //   });

  //   // Clear pending navigation to prevent duplicate sends
  //   setPendingNavigation(null);
  // }

  const storeLandingPage = async () => {
    try {
      if (context.postId) {
        console.log('[DEBUG-NAV] CustomPostPreview: Storing landing page in Redis');
        await context.redis.hSet(`navState:${context.postId}`, {
          page: 'landing',
        });
      }
    } catch (error) {
      console.error('[DEBUG-NAV] CustomPostPreview: Error storing landing page:', error);
    }
  };

  const handlePlayGame = () => {
    console.log('[DEBUG-NAV] CustomPostPreview: handlePlayGame pressed');

    storeLandingPage();
    // Mount the WebView
    onMount();

    // if (isWebViewReady) {
    //   console.log('[DEBUG-NAV] CustomPostPreview: WebView ready, sending navigation');
    //   safePostMessage({
    //     type: 'NAVIGATE',
    //     data: {
    //       page: 'landing',
    //     },
    //   });
    // } else {
    //   console.log(
    //     '[DEBUG-NAV] CustomPostPreview: WebView not ready yet, storing pending navigation'
    //   );
    //   setPendingNavigation({
    //     page: 'landing',
    //   });
    // }
  };

  const isSmallScreen = (context.dimensions?.width ?? 0) < 300;

  return (
    <vstack height="100%" width="100%" darkBackgroundColor="#0d1629" lightBackgroundColor="#E8E5DA">
      <spacer size="large" />

      {/* title */}
      <vstack alignment="center middle" padding="medium">
        <ComicText size={0.7} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {/* Intro text */}
      <vstack alignment="center middle" padding="medium">
        <spacer size="large" />
        <text color="orangered-500" size={isSmallScreen ? "large" : "xlarge"}  weight="bold">
          Hi {username}, ready to unravel the secret word/phrase
        </text>
        <text color="orangered-500" size={isSmallScreen ? "large" : "xlarge"} weight="bold">
          from GIFs?
        </text>
        <spacer size="medium"/>
      </vstack>

      {/* Main buttons section */}
      <hstack width="100%" padding="medium" alignment="center middle" gap="medium">
        <vstack
          backgroundColor="#c6c6e1"
          cornerRadius="large"
          width="30%"
          alignment="center middle"
          onPress={handlePlayGame}
        >
          <vstack gap="medium" height={150} cornerRadius="small">
            <image url="eyebrows.gif" imageWidth={200} imageHeight={100} />
          </vstack>
          {/* <vstack
            backgroundColor="rgba(0,0,0,0.3)"
            cornerRadius="large"
            padding="xsmall"
            width="100%"
            alignment="center"
          > */}
            {/* <hstack alignment="middle center"> */}
            {/* <ComicText size={0.2} color="dark-green">
                S       tart      Playing
              </ComicText> */}
            <button onPress={handlePlayGame}>Start Playing 👉</button>
            {/* <text> 👉</text> */}
            {/* </hstack> */}
          {/* </vstack> */}
        </vstack>
      </hstack>
    </vstack>
  );
};