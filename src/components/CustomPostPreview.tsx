import { Devvit, Context, useState, useAsync, useInterval } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { BlocksToWebviewMessage, Page, WebviewToBlockMessage } from '../../game/shared.js';

interface CustomPostPreviewProps {
  context: Context;
  onMount: () => void;
  postMessage: (message: BlocksToWebviewMessage) => void;
}

export const CustomPostPreview = ({ context, onMount, postMessage }: CustomPostPreviewProps) => {
  const [previewData, setPreviewData] = useState<{
    maskedWord?: string;
    gifs?: string[];
    gameId?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string>('there');
  const [pendingNavigation, setPendingNavigation] = useState<{
    page: Page;
    gameId?: string;
  } | null>(null);

  // Use interval to handle navigation after mounting the WebView
  const navInterval = useInterval(() => {
    if (pendingNavigation) {
      console.log('PostPreview: Sending navigation result for', pendingNavigation.page);

      postMessage({
        type: 'NAVIGATION_RESULT',
        success: true,
        page: pendingNavigation.page,
        ...(pendingNavigation.gameId ? { gameId: pendingNavigation.gameId } : {}),
      });

      setPendingNavigation(null);
      navInterval.stop();
    }
  }, 300);

  useAsync(
    async () => {
      if (!context.postId) return null;

      try {
        try {
          const currentUsername = await context.reddit.getCurrentUsername();
          if (currentUsername) {
            setUsername(currentUsername);
          }
        } catch (usernameError) {
          console.error('Error fetching username:', usernameError);
        }
        // First try to get game ID from post relationship
        const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');

        if (gameId) {
          // Get preview data from game preview storage
          const previewData = await context.redis.hGetAll(`gamePreview:${gameId}`);

          if (previewData && previewData.maskedWord) {
            setPreviewData({
              maskedWord: previewData.maskedWord,
              gifs: JSON.parse(previewData.gifs || '[]'),
              gameId: gameId,
            });
          } else {
            // Fallback: Get game data directly from game storage
            const gameData = await context.redis.hGetAll(`game:${gameId}`);
            if (gameData && gameData.maskedWord) {
              setPreviewData({
                maskedWord: gameData.maskedWord,
                gifs: JSON.parse(gameData.gifs || '[]'),
                gameId: gameId,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading game preview:', error);
      }
      return null;
    },
    {
      depends: [context.postId ?? ''],
      finally: (data, error) => {
        if (data && !error) {
          setUsername(data);
        }
        if (error) {
          console.error('Error fetching username:', error);
        }
        setIsLoading(false)
      }
    }
  );

  const handlePlayGame = () => {
    if (previewData.gameId) {
      context.ui.showToast('Loading game...');
      onMount();
      console.log('PostPreview: Sending NAVIGATION_RESULT for game page');
      postMessage({
        type: 'NAVIGATION_RESULT',
        success: true,
        page: 'game',
        gameId: previewData.gameId,
      });
    } else {
      context.ui.showToast('Game not found. Try creating a new one!');
    }
  };

  const handleCreateGame = () => {
    console.log('PostPreview: Mounting WebView for create game');
    onMount();

    // Send NAVIGATION_RESULT message which is a valid type in BlocksToWebviewMessage
    console.log('PostPreview: Sending NAVIGATION_RESULT for category page');
    postMessage({
      type: 'NAVIGATION_RESULT',
      success: true,
      page: 'category',
    });
  };

  const handleHowToPlay = () => {
    console.log('PostPreview: Mounting WebView for how to play');
    onMount();

    // Send NAVIGATION_RESULT message which is a valid type in BlocksToWebviewMessage
    console.log('PostPreview: Sending NAVIGATION_RESULT for howToPlay page');
    postMessage({
      type: 'NAVIGATION_RESULT',
      success: true,
      page: 'howToPlay',
    });
  };

  const handleLeaderboard = () => {
    console.log('PostPreview: Mounting WebView for leaderboard');
    onMount();

    postMessage({
      type: 'NAVIGATION_RESULT',
      success: true,
      page: 'leaderboard',
    });
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

  return (
    <vstack height="100%" width="100%" backgroundColor="#0d1629">
      {/* Top section with leaderboard */}
      <hstack width="100%" padding="small" alignment="middle">
        <spacer grow />
        <hstack
          padding="xsmall"
          border="thin"
          onPress={handleLeaderboard}
          backgroundColor="#f4f4f4"
          cornerRadius="full"
        >
          <ComicText size={0.2} color="#000000">
            Leaderboard
          </ComicText>
        </hstack>
      </hstack>

      {/* Title */}
      <vstack alignment="center middle" padding="medium">
        <ComicText size={0.8} color="#FF4500">
          GIF Enigma
        </ComicText>
      </vstack>

      {/* Intro text */}
      <vstack alignment="middle" padding="medium">
        <ComicText size={0.25} color="#7fcfff" alignment="center">
          {'                  Hi    ' + username + ',    ready    to    unravel    the    secret    word    from    GIFs?'}
        </ComicText>
      </vstack>

      {/* Main buttons section */}
      <hstack width="100%" padding="medium" alignment="center middle" gap="medium">
        {/* Play button */}
        <vstack
          backgroundColor="#c6c6e1"
          cornerRadius="large"
          width="45%"
          alignment="center middle"
          onPress={handlePlayGame}
        >
          <vstack gap="medium" padding="medium" height={150}>
            <image
              url="lets-play.gif"
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
            <ComicText size={0.2} color="white">
              Tap to Play →
            </ComicText>
          </vstack>
        </vstack>

        {/* Create button */}
        <vstack
          backgroundColor="#aec6cd"
          cornerRadius="large"
          width="45%"
          alignment="center middle"
          onPress={handleCreateGame}
        >
          <vstack gap="medium" padding="medium" height={100}>
            <image
              url="lets-build.gif"
              imageWidth={100}
              imageHeight={100}
              grow
              width={100}
              resizeMode="fit"
              description="Character building"
            />
          </vstack>
          <vstack
            backgroundColor="rgba(0,0,0,0.3)"
            padding="xsmall"
            width="100%"
            alignment="center"
          >
            <ComicText size={0.2} color="white">
              Tap to Create →
            </ComicText>
          </vstack>
        </vstack>
      </hstack>

      {/* How this game works button */}
      <vstack padding="medium" alignment="center">
        <hstack
          padding="xsmall"
          border="thin"
          onPress={handleHowToPlay}
          backgroundColor="#f4f4f4"
          cornerRadius="full"
          alignment="middle center"
          gap="small"
        >
          <ComicText size={0.2} color="#000000">
            How this game works?
          </ComicText>
        </hstack>
      </vstack>
    </vstack>
  );
};
