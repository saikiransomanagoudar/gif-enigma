import { Devvit, Context, useState, useAsync } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
// import { Page } from '../../game/lib/types.js';
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
    playGif: string | null;
    buildGif: string | null;
  }>({
    playGif: null,
    buildGif: null,
  });

  useAsync(
    async () => {
      // Get asset URLs
      const playGifUrl = context.assets.getURL('lets-play.gif');
      const buildGifUrl = context.assets.getURL('lets-build.gif');

      // Get username efficiently
      const currentUsername = (await context.reddit.getCurrentUsername()) || '';

      // Return all data together
      return {
        playGifUrl,
        buildGifUrl,
        currentUsername: currentUsername,
      };
    },
    {
      // Use the finally callback for state updates
      finally: (data, error) => {
        if (data && !error) {
          // Update state with the fetched data
          setGifUrls({
            playGif: data.playGifUrl,
            buildGif: data.buildGifUrl,
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

  useAsync(
    async () => {
      if (!context.postId) return null;

      // Get game ID from post relationship
      const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
      if (!gameId) return null;

      // Try to get preview data first
      const previewData = await context.redis.hGetAll(`gamePreview:${gameId}`);

      if (previewData && previewData.maskedWord) {
        return {
          maskedWord: previewData.maskedWord,
          gifs: JSON.parse(previewData.gifs || '[]'),
          gameId: gameId,
        };
      }

      // Fallback to game data
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      if (gameData && gameData.maskedWord) {
        return {
          maskedWord: gameData.maskedWord,
          gifs: JSON.parse(gameData.gifs || '[]'),
          gameId: gameId,
        };
      }

      return null;
    },
    {
      depends: [context.postId ?? ''],
      finally: (data, error) => {
        if (data && !error) {
          setPreviewData(data);
        }

        if (error) {
          console.error('Error loading game preview:', error);
        }

        setIsLoading(false);
      },
    }
  );

  //  Helper function to send navigation messages
  const safePostMessage = (message: any) => {
    console.log(
      '[DEBUG-NAV] CustomPostPreview: Sending navigation message:',
      JSON.stringify(message)
    );
    // @ts-ignore - Ignore TypeScript errors
    postMessage(message);
  };

  const handlePlayGame = () => {
    console.log('[DEBUG-NAV] CustomPostPreview: handlePlayGame pressed');
    onMount();

    if (isWebViewReady) {
      console.log('[DEBUG-NAV] CustomPostPreview: WebView ready, sending navigation');
      safePostMessage({
        type: 'NAVIGATE',
        data: {
          page: 'game',
          params: {}
        },
      });
    } else {
      console.log('[DEBUG-NAV] CustomPostPreview: WebView not ready yet');
    }
  };

  return (
    <vstack height="100%" width="100%" backgroundColor="#0d1629">
      <spacer size="large" />

      {/* title */}
      <vstack alignment="center middle" padding="medium">
        <ComicText size={0.7} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {/* Intro text */}
      <vstack alignment="middle" padding="xsmall">
        <spacer size="large" />
        <ComicText size={0.25} color="#7fcfff">
          {`                                  Hi    ${username},    ready    to    unravel`}
        </ComicText>
        <ComicText size={0.25} color="#7fcfff">
          {`                                  the    secret    word/phrase    from    GIFs?`}
        </ComicText>
      </vstack>

      {/* Main buttons section */}
      <hstack width="100%" padding="medium" alignment="center middle" gap="medium">
        <vstack
          backgroundColor="#c6c6e1"
          cornerRadius="large"
          width="45%"
          alignment="center middle"
          onPress={handlePlayGame}
        >
          <spacer size="medium" />
          <vstack gap="medium" padding="medium" height={150}>
            <image
              url="eyebrows.gif"
              imageWidth={100}
              imageHeight={100}
              grow
              width={100}
              resizeMode="fit"
              description="Characters playing"
            />
          </vstack>
          <vstack
            backgroundColor="rgba(0,0,0,0.3)"
            padding="xsmall"
            width="100%"
            alignment="center"
          >
            <hstack alignment="middle center">
              <ComicText size={0.2} color="white">
                S       tart      Playing
              </ComicText>
              <text> 👉</text>
            </hstack>
          </vstack>
        </vstack>
      </hstack>
    </vstack>
  );
};
