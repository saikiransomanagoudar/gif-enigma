import { Devvit, Context, useWebView, useState, useAsync } from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import { saveGame, getUserGames, getGame } from '../game/server/gameHandler.server.js';
import { Page } from '../game/lib/types.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../game/server/geminiApi.server.js';
import { CustomPostPreview } from './components/CustomPostPreview.js';
import { GamePostPreview } from './components/GamePostPreview.js';

Devvit.addSettings([
  {
    name: 'tenor-api-key',
    label: 'Tenor API Key',
    type: 'string',
    isSecret: true,
    scope: 'app',
  },
  {
    name: 'oauth-client-id',
    label: 'OAuth Client ID',
    type: 'string',
    isSecret: true,
    scope: 'app',
  },
  {
    name: 'gemini-api-key',
    label: 'Gemini API Key',
    type: 'string',
    isSecret: true,
    scope: 'app',
  },
]);

Devvit.configure({
  redditAPI: true,
  media: true,
  kvStore: true,
  redis: true,
  http: true,
  realtime: true,
});

Devvit.addCustomPostType({
  name: 'GIF Enigma',
  height: 'tall',
  render: (context) => {
    let persistentPage: Page | null = null;
    let isWebViewReadyFlag: boolean = false;
    // @ts-ignore
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      onMessage: async (
        rawMessage: WebviewToBlockMessage,
        { postMessage }: { postMessage: (message: BlocksToWebviewMessage) => void }
      ) => {
        console.log('[DEBUG] main.tsx onMessage received:', rawMessage);

        // Unwrap the devvit-message wrapper(s) (using a cast to any)
        let event: any;
        const messageAny = rawMessage as any;
        if (messageAny?.type === 'devvit-message') {
          if (messageAny.data?.type === 'devvit-message' && messageAny.data?.message) {
            // Double-wrapped scenario
            event = messageAny.data.message;
            console.log('[DEBUG] main.tsx unwrapped double layer:', event);
          } else if (messageAny.data) {
            // Single-wrapped scenario
            event = messageAny.data;
            console.log('[DEBUG] main.tsx unwrapped single layer:', event);
          } else {
            console.log('[DEBUG] main.tsx: No data to unwrap, using raw message');
            event = messageAny;
          }
        } else {
          event = messageAny;
        }

        switch (event.type) {
          case 'webViewReady':
            console.log('[DEBUG] main.tsx: webViewReady received');
            isWebViewReadyFlag = true;
            break;

          case 'INIT':
            console.log(
              '[DEBUG-NAV] main.tsx: INIT message received, current persistentPage:',
              persistentPage
            );

            // Create a properly typed response
            const initResponse: any = {
              type: 'INIT_RESPONSE',
              data: {
                postId: context.postId || '',
                desiredPage: persistentPage,
              },
            };

            console.log(
              '[DEBUG-NAV] main.tsx: Sending INIT_RESPONSE:',
              JSON.stringify(initResponse)
            );
            postMessage(initResponse);
            break;

          case 'GAME_DATA':
            const { maskedWord, gifs } = event.data;
            await context.redis.hSet(`gamePreview:${context.postId}`, {
              maskedWord,
              gifs: JSON.stringify(gifs),
            });

            postMessage({
              type: 'GAME_DATA_RESULT',
              success: true,
              data: { maskedWord, gifs },
            });
            break;

          case 'GET_CURRENT_USER':
            try {
              const username = await context.reddit.getCurrentUsername();

              if (username) {
                postMessage({
                  type: 'GET_CURRENT_USER_RESULT',
                  success: true,
                  user: { username },
                });
              } else {
                postMessage({
                  type: 'GET_CURRENT_USER_RESULT',
                  success: false,
                  error: 'User not logged in or username not available',
                });
              }
            } catch (error) {
              console.error('Error getting current user:', error);
              postMessage({
                type: 'GET_CURRENT_USER_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_USER_GAMES':
            try {
              console.log('Getting games for user:', event.data.userId);
              const userId = event.data.userId;
              const result = await getUserGames(
                {
                  userId,
                  limit: event.data.limit || 10,
                },
                context
              );
              const serializedGames = result.games
                ? result.games.map(
                    (game: {
                      id: any;
                      word: any;
                      maskedWord: any;
                      questionText: any;
                      gifs: any;
                      createdAt: any;
                      creatorId: any;
                      creatorUsername: any;
                      redditPostId: any;
                    }) => ({
                      id: game.id,
                      word: game.word,
                      maskedWord: game.maskedWord,
                      questionText: game.questionText,
                      gifs: Array.isArray(game.gifs) ? game.gifs : [],
                      createdAt: game.createdAt,
                      creatorId: game.creatorId,
                      creatorUsername: game.creatorUsername,
                      redditPostId: game.redditPostId,
                    })
                  )
                : [];

              postMessage({
                type: 'GET_USER_GAMES_RESULT',
                success: result.success,
                games: serializedGames,
                message: result.message,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting user games:', error);
              postMessage({
                type: 'GET_USER_GAMES_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_RANDOM_GAME':
            try {
              console.log('Getting random game, excluding:', event.data.excludeIds);
              // Import the getRandomGame function from gameHandler.server.js
              const { getRandomGame } = await import('../game/server/gameHandler.server.js');
              const result = await getRandomGame(event.data || {}, context);

              // Convert to serializable format if needed
              postMessage({
                type: 'GET_RANDOM_GAME_RESULT',
                success: result.success,
                result: result,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting random game:', error);
              postMessage({
                type: 'GET_RANDOM_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'CALCULATE_SCORE':
            try {
              console.log('Calculating score:', event.data);
              const { calculateScore } = await import('../game/server/scoringService.js');
              const scoreResult = {
                ...calculateScore(event.data),
                username: event.data.username
              };

              postMessage({
                type: 'CALCULATE_SCORE_RESULT',
                success: true,
                result: scoreResult,
              });
            } catch (error) {
              console.error('Error calculating score:', error);
              postMessage({
                type: 'CALCULATE_SCORE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_SCORE':
            try {
              console.log('💾 [DEBUG] Saving score with data:', event.data);
              const { saveScore } = await import('../game/server/scoringService.js');
              const result = await saveScore(event.data, context);

              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error saving score:', error);
              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME_LEADERBOARD':
            try {
              console.log('Getting game leaderboard for:', event.data.gameId);
              const { getGameLeaderboard } = await import('../game/server/scoringService.js');
              const result = await getGameLeaderboard(event.data, context);

              postMessage({
                type: 'GET_GAME_LEADERBOARD_RESULT',
                success: result.success,
                result: { leaderboard: result.leaderboard || [] },
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting game leaderboard:', error);
              postMessage({
                type: 'GET_GAME_LEADERBOARD_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_GAME_STATE':
            try {
              console.log('Saving game state:', event.data);
              const { saveGameState } = await import('../game/server/gameHandler.server.js');
              const result = await saveGameState(event.data, context);

              postMessage({
                type: 'SAVE_GAME_STATE_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error saving game state:', error);
              postMessage({
                type: 'SAVE_GAME_STATE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME':
            try {
              console.log('Getting game:', event.data.gameId);
              const result = await getGame(
                {
                  gameId: event.data.gameId,
                },
                context
              );

              postMessage({
                type: 'GET_GAME_RESULT',
                success: result.success,
                game: result.game,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting game:', error);
              postMessage({
                type: 'GET_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME_STATE':
            try {
              console.log('Getting game state:', event.data);
              const { getGameState } = await import('../game/server/gameHandler.server.js');
              const result = await getGameState(event.data, context);

              postMessage({
                type: 'GET_GAME_STATE_RESULT',
                success: result.success,
                state: result.state,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting game state:', error);
              postMessage({
                type: 'GET_GAME_STATE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GEMINI_RECOMMENDATIONS': {
            try {
              console.log('MainApp: Processing Gemini recommendations request', event.data);

              if (!event.data) {
                throw new Error('No data received in request');
              }

              const { category, inputType, count } = event.data;
              console.log('MainApp: Fetching recommendations for', category, inputType, count);

              const result = await fetchGeminiRecommendations(context, category, inputType, count);

              console.log(
                'MainApp: Recommendations result:',
                JSON.stringify({
                  success: result.success,
                  count: result.recommendations?.length,
                  error: result.error,
                })
              );

              postMessage({
                type: 'GET_GEMINI_RECOMMENDATIONS_RESULT',
                success: result.success,
                result: result.recommendations,
                error: result.error,
              });
            } catch (error) {
              console.error('MainApp: Error in GET_GEMINI_RECOMMENDATIONS handler:', error);
              postMessage({
                type: 'GET_GEMINI_RECOMMENDATIONS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;
          }

          case 'GET_GEMINI_SYNONYMS': {
            try {
              console.log('MainApp: Processing Gemini synonyms request', event.data);

              if (!event.data) {
                throw new Error('No data received in request');
              }

              const { word } = event.data;
              console.log('MainApp: Fetching synonyms for', word);

              const result = await fetchGeminiSynonyms(context, word);

              console.log(
                'MainApp: Synonyms result:',
                JSON.stringify({
                  success: result.success,
                  count: result.synonyms?.length,
                  error: result.error,
                })
              );

              postMessage({
                type: 'GET_GEMINI_SYNONYMS_RESULT',
                success: result.success,
                result: result.synonyms,
                error: result.error,
              });
            } catch (error) {
              console.error('MainApp: Error in GET_GEMINI_SYNONYMS handler:', error);
              postMessage({
                type: 'GET_GEMINI_SYNONYMS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;
          }
          case 'SEARCH_TENOR_GIFS':
            try {
              console.log('Searching Tenor GIFs for:', event.data.query);
              const gifResults = await searchTenorGifs(
                context,
                event.data.query,
                event.data.limit || 8
              );

              postMessage({
                type: 'SEARCH_TENOR_GIFS_RESULT',
                success: true,
                results: gifResults,
              });
            } catch (error) {
              console.error('Error searching Tenor GIFs:', error);
              postMessage({
                type: 'SEARCH_TENOR_GIFS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_GAME':
            try {
              const username = await context.reddit.getCurrentUsername();
              const result = await saveGame(event.data, context);
              if (result.success && result.redditPostId) {
                await context.redis.hSet(`post:${result.redditPostId}`, { gameId: result.gameId! });
                await context.redis.hSet(`gamePreview:${result.gameId}`, {
                  maskedWord: event.data.maskedWord,
                  gifs: JSON.stringify(event.data.gifs),
                  creatorUsername: username || 'Unknown',
                });
              }
              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: result.success,
                result,
                error: result.error,
              });
            } catch (error) {
              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'MARK_GAME_COMPLETED':
            try {
              await context.redis.zAdd(
                `user:${event.data.username}:completedGames`,
                { member: event.data.gameId, score: Date.now() }
              );
              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: true
              });
            } catch (error) {
              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: false,
                error: String(error)
              });
            }
            break;
          case 'NAVIGATION':
            console.log('[DEBUG] main.tsx: NAVIGATION message received:', event);
            persistentPage = event.page;
            console.log('[DEBUG] main.tsx: persistentPage set to:', persistentPage);
            postMessage({
              type: 'NAVIGATION_RESULT',
              success: true,
              page: event.page,
              ...(event.gameId ? { gameId: event.gameId } : {}),
            });
            break;

          case 'NAVIGATE':
            console.log('[DEBUG-NAV] main.tsx: NAVIGATE message received!');
            try {
              console.log('[DEBUG-NAV] main.tsx: Full NAVIGATE message:', JSON.stringify(event));

              // Extract page and gameId from the message
              let targetPage: Page | null = null;
              let gameId: string | undefined = undefined;

              if (event.data && typeof event.data === 'object') {
                targetPage = event.data.page as Page;
                if (event.data.params && event.data.params.gameId) {
                  gameId = event.data.params.gameId;
                }
              } else if (event.page) {
                targetPage = event.page as Page;
                if (event.gameId) {
                  gameId = event.gameId;
                }
              }

              if (targetPage) {
                console.log('[DEBUG-NAV] main.tsx: Setting persistentPage to:', targetPage);
                persistentPage = targetPage;

                // Create a properly typed response
                const navigationResult: any = {
                  type: 'NAVIGATION_RESULT',
                  success: true,
                  page: targetPage,
                };

                // Add gameId if it exists
                if (gameId) {
                  navigationResult.gameId = gameId;
                }

                console.log(
                  '[DEBUG-NAV] main.tsx: Sending response:',
                  JSON.stringify(navigationResult)
                );
                postMessage(navigationResult);
              } else {
                console.error('[DEBUG-NAV] main.tsx: Could not find page in NAVIGATE message');
              }
            } catch (error) {
              console.error('[DEBUG-NAV] main.tsx: Error processing NAVIGATE message:', error);
            }
            break;
        }
      },
    });

    const PostPreviewComponent = ({
      context,
      mount,
      postMessage,
    }: {
      context: Context;
      mount: any;
      postMessage: any;
    }) => {
      const [isGame, setIsGame] = useState(false);
      const [isLoading, setIsLoading] = useState(true);

      useAsync(
        async () => {
          if (!context.postId) return false;

          // Check if this post has a game ID associated with it
          const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
          console.log('Post preview check - gameId found:', gameId);
          return !!gameId; // Convert to boolean
        },
        {
          depends: [context.postId ?? ''],
          finally: (result, error) => {
            setIsGame(!!result);
            setIsLoading(false);
            console.log('Post preview component - isGame:', !!result);
          },
        }
      );

      if (isLoading) {
        return (
          <vstack height="100%" width="100%" alignment="center middle">
            <text style="heading" size="medium">
              Loading GIF Enigma...
            </text>
          </vstack>
        );
      }

      return isGame ? (
        <GamePostPreview
          context={context}
          onMount={mount}
          postMessage={postMessage}
          isWebViewReady={isWebViewReadyFlag}
        />
      ) : (
        <CustomPostPreview
          context={context}
          onMount={mount}
          postMessage={postMessage}
          isWebViewReady={isWebViewReadyFlag}
        />
      );
    };

    return (
      <zstack height="100%" width="100%" alignment="center middle">
        <PostPreviewComponent context={context} mount={mount} postMessage={postMessage} />
      </zstack>
    );
  },
});

Devvit.addMenuItem({
  label: 'Create GIF Enigma Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    const post = await reddit.submitPost({
      title: 'New GIF Enigma Challenge!',
      subredditName: subreddit.name,
      preview: (
        <CustomPostPreview
          context={context}
          onMount={() => {}}
          postMessage={() => {}}
          isWebViewReady={false}
        />
      ),
    });

    ui.showToast('Created new GIF Enigma post!');
    ui.navigateTo(post.url);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '1.0.0.0';
}

export default Devvit;
