import { Devvit, Context, useState, useAsync } from '@devvit/public-api';
import { ComicText } from '../utils/fonts/comicText.js';
import { Page } from '../../game/lib/types.js';
import { BlocksToWebviewMessage } from '../../game/shared.js';

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
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('there');
  const [_gifUrls, setGifUrls] = useState<{
    playGif: string | null;
    buildGif: string | null;
  }>({
    playGif: null,
    buildGif: null,
  });
  const [pendingNavigation, setPendingNavigation] = useState<{
    page: Page;
    gameId?: string;
  } | null>(null);
  
  useAsync(
    async () => {
      const playGifUrl = context.assets.getURL('eyebrows.gif');
      const buildGifUrl = context.assets.getURL('lets-build-optimized.gif');

      const currentUsername = (await context.reddit.getCurrentUsername()) || '';

      return {
        playGifUrl: playGifUrl,
        buildGifUrl: buildGifUrl,
        currentUsername: currentUsername,
      };
    },
    {
      finally: (data, error) => {
        if (data && !error) {
          setGifUrls({
            playGif: data.playGifUrl,
            buildGif: data.buildGifUrl,
          });

          if (data.currentUsername) {
            setUsername(data.currentUsername);
          }
        }

        setIsLoading(false);
      },
    }
  );

  useAsync<{ shouldNavigate: boolean; page?: Page; gameId?: string }>(
    async () => {
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
          postMessage({
            type: 'SET_NAVIGATION_STATE',
            data: {
              page: data.page,
              ...(data.gameId ? { gameId: data.gameId } : {}),
            },
          });

          setPendingNavigation(null);
        }
      },
    }
  );

  const handlePlayGame = async (retryCount = 0) => {
    const MAX_RETRIES = 3;

    try {
      setIsLoading(true);

      const { getRandomGame } = await import('../../game/server/gameHandler.server.js');

      const params = {
        excludeIds: [],
        preferUserCreated: true,
        username: username || 'anonymous',
      };

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getRandomGame timeout after 10 seconds')), 10000)
      );

      const result = await Promise.race([
        getRandomGame(params, context),
        timeoutPromise
      ]);

      if (result.success && result.game) {
        const game = result.game;
                
        if (game.redditPostId && game.gifs && Array.isArray(game.gifs) && game.gifs.length > 0 && game.word) {
          // Navigate to the specific game post directly
          try {
            const post = await context.reddit.getPostById(game.redditPostId);
            
            if (post && !post.removed) {
              // Show confirmation toast only after verifying the post is valid
              context.ui.showToast('🎊 Found a new game!');
              
              if (post.url) {
                context.ui.navigateTo(post.url);
              } else if (post.permalink) {
                const fullUrl = `https://www.reddit.com${post.permalink}`;
                context.ui.navigateTo(fullUrl);
              } else {
                // Fallback: construct URL manually
                const cleanPostId = game.redditPostId.replace('t3_', '');
                const postUrl = `https://www.reddit.com/r/PlayGIFEnigma/comments/${cleanPostId}/`;
                context.ui.navigateTo(postUrl);
              }
            } else {
              if (retryCount < MAX_RETRIES) {
                handlePlayGame(retryCount + 1);
              } else {
                context.ui.showToast('Could not find a valid game to play. Please try again.');
              }
            }
          } catch (error) {
            // Try to find another game with retry limit
            if (retryCount < MAX_RETRIES) {
              handlePlayGame(retryCount + 1);
            } else {
              context.ui.showToast('Error finding a game. Please try again.');
            }
          }
        } else {
          context.ui.showToast('Could not find a valid game to play. Please try again.');
        }
      } else {
        context.ui.showToast('No games available! Create your first game by clicking "Let\'s Build"');
      }
      
    } catch (error) {
      context.ui.showToast('Error finding a game. Please try again.');
    } finally {
      setIsLoading(false);
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
      setPendingNavigation({
        page: 'category',
      });
    } catch (error) {
      onMount();
      setPendingNavigation({
        page: 'category',
      });
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
      setPendingNavigation({
        page: 'howToPlay',
      });
    } catch (error) {
      onMount();
      setPendingNavigation({
        page: 'howToPlay',
      });
    }
  };

  const isSmallScreen = (context.dimensions?.width ?? 0) < 420;
  const cardSize = isSmallScreen
  ? Math.floor((context.dimensions?.width ?? 320) * 0.4)
  : Math.floor((context.dimensions?.width ?? 800) * 0.25);

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
              <text size="large">🤔</text>
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
              setPendingNavigation({
                page: 'leaderboard',
              });
            } catch (error) {
              onMount();
              setPendingNavigation({
                page: 'leaderboard',
              });
            }
          }}
        >
          <hstack gap="small" alignment="center middle">
            <text size="xlarge">🏆</text>
            {!isSmallScreen && (
              <ComicText size={0.20} color="#FF4500" bold>
                Leaderboard
              </ComicText>
            )}
          </hstack>
        </vstack>
      </hstack>
    </zstack>
  );
};
