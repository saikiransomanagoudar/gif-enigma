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
  const [isWebViewMounted, setIsWebViewMounted] = useState(false);
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
        setIsLoading(false);
      },
    }
  );

  useAsync<{ shouldNavigate: boolean; page?: Page; gameId?: string }>(
    async () => {
      // Return a promise that resolves if we should navigate
      if (isWebViewReady && pendingNavigation) {
        return {
          shouldNavigate: true,
          page: pendingNavigation.page,
          gameId: pendingNavigation.gameId,
        };
      }
      return { shouldNavigate: false };
    },
    {
      depends: [isWebViewReady, pendingNavigation],
      finally: (data, error) => {
        if (!error && data?.shouldNavigate) {
          console.log(
            '[DEBUG-NAV] CustomPostPreview: WebView is ready, sending pending navigation to:',
            data.page
          );

          // Send the navigation message
          postMessage({
            type: 'SET_NAVIGATION_STATE',
            data: {
              page: data.page,
              ...(data.gameId ? { gameId: data.gameId } : {}),
            },
          });

          // Clear pending navigation to prevent duplicate sends
          setPendingNavigation(null);
        }
      },
    }
  );

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

  const handlePlayGame = async () => {
    console.log('[DEBUG-NAV] CustomPostPreview: handlePlayGame pressed');

    // Always store the landing page as the destination
    await storeLandingPage();

    // Force remount the WebView every time
    console.log('[DEBUG-NAV] CustomPostPreview: Force remounting WebView');
    setIsWebViewMounted(false);

    // Use this approach to create a small delay without setTimeout
    await context.redis.set('temp_key', 'temp_value');

    // Now mount it again
    setIsWebViewMounted(true);
    onMount();

    // Set landing as the destination
    setPendingNavigation({
      page: 'landing',
    });
  };

  const isSmallScreen = (context.dimensions?.width ?? 0) < 420;
  console.log('[DEBUG] Block width:', context.dimensions?.width);

  return (
    <vstack height="100%" width="100%" darkBackgroundColor="#0d1629" lightBackgroundColor="#E8E5DA">
      <spacer size="large" />

      {/* title */}
      <vstack alignment="center middle" padding="medium">
        <ComicText size={isSmallScreen ? 0.5 : 0.6} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>
      {/* Intro text */}
      <vstack alignment="center middle" padding="medium" width="100%">
        <spacer size="large" />
        {isSmallScreen ? (
            <vstack alignment="center middle">
            <ComicText size={0.21} color="#FF4500" bold>
              Ready to crack the GIF code,
            </ComicText>
            <ComicText size={0.21} color="#FF4500" bold>
              {`${username}?`}
            </ComicText>
          </vstack>
        ) : (
          <ComicText size={0.21} color="#FF4500" bold>
            {`Ready to crack the GIF code, ${username}?`}
          </ComicText>
        )}
        <spacer size="medium" />
      </vstack>

      {/* Main buttons section */}
      <hstack width="100%" padding="medium" alignment="center middle">
        <vstack
          backgroundColor="#c6c6e1"
          cornerRadius="large"
          width={isSmallScreen ? '95%' : '50%'}
          padding="medium"
          alignment="center middle"
          border="thin"
          borderColor="#9494c8"
        >
          <vstack gap="medium" cornerRadius="medium" width="100%" alignment="center middle">
            <image
              url="eyebrows.gif"
              imageWidth={isSmallScreen ? 150 : 200}
              imageHeight={100}
              resizeMode="fit"
            />
          </vstack>
          <spacer size="medium" />
          <vstack 
            backgroundColor="#6A0DAD" 
            cornerRadius="full" 
            padding="medium"
            onPress={handlePlayGame}
          >
            <hstack gap="small" alignment="center middle">
              <vstack alignment="center middle">
                <icon name="play" color="white" size="medium" />
              </vstack>
              <vstack alignment="center middle">
                <spacer size="xsmall" />
                <ComicText size={0.16} color="white" bold>
                  Play Now
                </ComicText>
              </vstack>
              <vstack alignment="center middle">
                <text color="white" size="large">👉</text>
              </vstack>
            </hstack>
          </vstack>
          <spacer size="small" />
        </vstack>
      </hstack>
    </vstack>
  );
};
