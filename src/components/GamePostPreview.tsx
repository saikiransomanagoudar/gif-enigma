import { Devvit, Context, useState, useAsync } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { BlocksToWebviewMessage } from '../../game/shared.js';
import { Page } from '../../game/lib/types.js';

interface GamePostPreviewProps {
  context: Context;
  onMount: () => void;
  postMessage: (message: BlocksToWebviewMessage) => void;
  isWebViewReady: boolean;
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

  // Load game data for this post
  useAsync(
    async () => {
      if (!context.postId) return null;

      // Try to get username
      try {
        const currentUsername = await context.reddit.getCurrentUsername();
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

      if (previewData && previewData.maskedWord) {
        return {
          maskedWord: previewData.maskedWord || '',
          gifs: JSON.parse(previewData.gifs || '[]'),
          gameId: gameId,
        };
      }

      // Fallback to game data
      const gameData = await context.redis.hGetAll(`game:${gameId}`);
      if (gameData && gameData.maskedWord) {
        return {
          maskedWord: gameData.maskedWord || '',
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

  const handlePlayGame = () => {
    if (previewData.gameId) {
      console.log("[DEBUG-NAV] GamePostPreview: onPress handlePlayGame, gameId:", previewData.gameId);
      context.ui.showToast('Loading game...');
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
        console.log('[DEBUG-NAV] GamePostPreview: WebView not ready yet');
        // The WebView isn't ready yet
        // You could set a flag here if needed
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
    <vstack height="100%" width="100%" backgroundColor="#0d1629" padding="small">
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
            width="95%"
            alignment="center middle"
          >
            <vstack
              height={200}
              width="95%"
              backgroundColor="#0a1020"
              cornerRadius="medium"
              padding="xsmall"
              alignment="center middle"
            >
              <image
                url={firstGif}
                imageWidth={190}
                imageHeight={190}
                resizeMode="fit"
                description="First GIF clue"
              />

              {!gifLoaded && (
                <text size="small" color="#ffffff" weight="bold">
                  Loading GIF...
                </text>
              )}
            </vstack>
          </vstack>
        )}

        {/* Word to guess with boxes */}
        <vstack padding="small" alignment="center middle" gap="small">
          <text size="medium" weight="bold" color="#ffffff">
            Guess the word/phrase:
          </text>

          <hstack gap="small" alignment="center middle">
            {letterBoxes.map((letter, index) => (
              <vstack
                key={index.toString()}
                width={28}
                height={36}
                backgroundColor={letter ? '#2a3f66' : '#1a2740'}
                cornerRadius="small"
                border="thin"
                borderColor="#3a4f76"
                alignment="center middle"
              >
                <text color="#ffffff" weight="bold" size="large">
                  {letter}
                </text>
              </vstack>
            ))}
          </hstack>
        </vstack>
      </vstack>

      {/* Play button */}
      <vstack padding="medium" alignment="center middle">
        <hstack
          backgroundColor="#FF4500"
          cornerRadius="full"
          padding="medium"
          onPress={handlePlayGame}
          alignment="center middle"
          width={180}
        >
          <text color="#ffffff" weight="bold">
            Solve It!
          </text>
        </hstack>

        <vstack padding="small">
          <text size="small" color="#7fcfff">
            {`Hi u/${username}, can you solve this GIF Enigma?`}
          </text>
        </vstack>
      </vstack>

      {/* Footer */}
      <hstack alignment="center middle" padding="small" gap="medium">
        <text color="#7fcfff" onPress={handleHowToPlay} size="small">
          How to play
        </text>

        <text color="#7fcfff" onPress={handlePlayGame} size="small">
          See all 4 clues
        </text>
      </hstack>
    </vstack>
  );
};
