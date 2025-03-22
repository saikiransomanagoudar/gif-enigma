import { Devvit, Context, useWebView } from '@devvit/public-api';
import {
  BlocksToWebviewMessage,
  WebviewToBlockMessage,
} from '../game/shared.js';
import { Preview } from './components/Preview.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import { saveGame, getRecentGames, getUserGames } from '../game/server/gameHandler.server.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../game/server/geminiApi.server.js';

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
    // @ts-ignore
    const { mount } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      onMessage: async (event, { postMessage }) => {
        console.log('Received message from web app:', event.type);

        switch (event.type) {
          case 'INIT':
            postMessage({
              type: 'INIT_RESPONSE',
              payload: {
                postId: context.postId || '',
              },
            });
            break;

          case 'GET_CURRENT_USER':
            try {
              console.log('Getting current user information');
              const currentUser = await context.reddit.getCurrentUser();

              if (currentUser) {
                postMessage({
                  type: 'GET_CURRENT_USER_RESULT',
                  success: true,
                  user: {
                    id: currentUser.id,
                    username: currentUser.username,
                  },
                });
              } else {
                postMessage({
                  type: 'GET_CURRENT_USER_RESULT',
                  success: false,
                  error: 'Could not retrieve current user',
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

              // Convert result to serializable games for postMessage
              const serializedGames = result.games
                ? result.games.map((game: { id: any; word: any; maskedWord: any; questionText: any; gifs: any; createdAt: any; creatorId: any; creatorUsername: any; redditPostId: any; }) => ({
                    id: game.id,
                    word: game.word,
                    maskedWord: game.maskedWord,
                    questionText: game.questionText,
                    gifs: Array.isArray(game.gifs) ? game.gifs : [],
                    createdAt: game.createdAt,
                    creatorId: game.creatorId,
                    creatorUsername: game.creatorUsername,
                    redditPostId: game.redditPostId,
                  }))
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

          case 'GET_USER_BY_ID':
            try {
              const userId = event.data.userId;

              if (!userId || !userId.startsWith('t2_')) {
                postMessage({
                  type: 'GET_USER_BY_ID_RESULT',
                  success: false,
                  error: 'Invalid user ID format. Reddit user IDs should start with t2_',
                });
                break;
              }

              const user = await context.reddit.getUserById(userId);

              if (user) {
                postMessage({
                  type: 'GET_USER_BY_ID_RESULT',
                  success: true,
                  user: {
                    id: user.id,
                    username: user.username,
                    // Add other user properties as needed
                  },
                });
              } else {
                postMessage({
                  type: 'GET_USER_BY_ID_RESULT',
                  success: false,
                  error: 'User not found',
                });
              }
            } catch (error) {
              console.error('Error getting user by ID:', error);
              postMessage({
                type: 'GET_USER_BY_ID_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;
          case 'GET_GEMINI_RECOMMENDATIONS': {
            try {
              const { category, inputType, count } = event.data;
              const result = await fetchGeminiRecommendations(context, category, inputType, count);
              postMessage({
                type: 'GET_GEMINI_RECOMMENDATIONS_RESULT',
                success: result.success,
                result: result.recommendations,
                error: result.error,
              });
            } catch (error) {
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
              const { word } = event.data;
              const result = await fetchGeminiSynonyms(context, word);
              postMessage({
                type: 'GET_GEMINI_SYNONYMS_RESULT',
                success: result.success,
                result: result.synonyms,
                error: result.error,
              });
            } catch (error) {
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

          // case 'UPLOAD_TENOR_GIF': {
          //   try {
          //     const { tenorGifUrl, gifId } = event.data; // gifId passed from the webview
          //     const response = await context.media.upload({
          //       url: tenorGifUrl,
          //       type: 'gif',
          //     });
          //     postMessage({
          //       type: 'UPLOAD_TENOR_GIF_RESULT',
          //       success: true,
          //       mediaUrl: response.mediaUrl, // Use the provided mediaUrl
          //       mediaId: response.mediaId,
          //       gifId, // Pass gifId to correlate with the uploaded asset
          //     });
          //   } catch (error) {
          //     postMessage({
          //       type: 'UPLOAD_TENOR_GIF_RESULT',
          //       success: false,
          //       error: String(error),
          //       gifId: event.data.gifId,
          //     });
          //   }
          //   break;
          // }

          case 'SAVE_GAME':
            try {
              console.log('Saving game:', event.data);
              const result = await saveGame(event.data, context);

              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: true,
                result,
              });
            } catch (error) {
              console.error('Error saving game:', error);
              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_RECENT_GAMES':
            try {
              console.log('Getting recent games');
              const result = await getRecentGames(event.data || {}, context);

              // Convert result to a simple serializable object
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
                      redditPostId: any;
                    }) => ({
                      id: game.id,
                      word: game.word,
                      maskedWord: game.maskedWord,
                      questionText: game.questionText,
                      gifs: Array.isArray(game.gifs) ? game.gifs : [],
                      createdAt: game.createdAt,
                      creatorId: game.creatorId,
                      redditPostId: game.redditPostId,
                    })
                  )
                : [];

              // Create a simple serializable response
              postMessage({
                type: 'GET_RECENT_GAMES_RESULT',
                success: result.success,
                result: {
                  games: serializedGames,
                  success: true
                },              
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error getting recent games:', error);
              postMessage({
                type: 'GET_RECENT_GAMES_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          default:
            console.error('Unknown message type', event);
            break;
        }
      },
    });

    return (
      <vstack height="100%" width="100%" alignment="center middle">
        <button
          onPress={() => {
            mount();
          }}
        >
          Play GIF Enigma
        </button>
      </vstack>
    );
  },
});

Devvit.addMenuItem({
  label: 'Create GIF Enigma Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    const post = await reddit.submitPost({
      title: 'GIF Enigma Game',
      subredditName: subreddit.name,
      preview: <Preview />,
    });

    ui.showToast({ text: 'Created GIF Enigma post!' });
    ui.navigateTo(post.url);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '0.1.0.0';
}

export default Devvit;
