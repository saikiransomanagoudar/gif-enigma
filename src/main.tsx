import { Devvit, Context, useWebView } from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { Preview } from './components/Preview.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import { saveGame, getRecentGames, getGame } from '../game/server/gameHandler.server.js';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from '../game/server/geminiApi.server.js';

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
  }
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
  name: 'GIF Enigma Game',
  height: 'tall',
  render: (context) => {
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
            case 'GET_GEMINI_RECOMMENDATIONS': {
              try {
                const { category, inputType, count } = event.data;
                const result = await fetchGeminiRecommendations(context, category, inputType, count);
                postMessage({
                  type: 'GET_GEMINI_RECOMMENDATIONS_RESULT',
                  success: result.success,
                  result: result.recommendations,
                  error: result.error
                });
              } catch (error) {
                postMessage({
                  type: 'GET_GEMINI_RECOMMENDATIONS_RESULT',
                  success: false,
                  error: String(error)
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
                  error: result.error
                });
              } catch (error) {
                postMessage({
                  type: 'GET_GEMINI_SYNONYMS_RESULT',
                  success: false,
                  error: String(error)
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
                results: gifResults
              });
            } catch (error) {
              console.error('Error searching Tenor GIFs:', error);
              postMessage({
                type: 'SEARCH_TENOR_GIFS_RESULT',
                success: false,
                error: String(error)
              });
            }
            break;

          case 'SEARCH_GIFS':
            try {
              console.log('Searching GIFs for:', event.data.query);
              const gifResults = await searchTenorGifs(
                context,
                event.data.query,
                event.data.limit || 8
              );
              
              postMessage({
                type: 'SEARCH_GIFS_RESULT',
                success: true,
                results: gifResults
              });
            } catch (error) {
              console.error('Error searching GIFs:', error);
              postMessage({
                type: 'SEARCH_GIFS_RESULT',
                success: false,
                error: String(error)
              });
            }
            break;

          case 'SAVE_GAME':
            try {
              console.log('Saving game:', event.data);
              const result = await saveGame(event.data, context);
              
              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: true,
                result
              });
            } catch (error) {
              console.error('Error saving game:', error);
              postMessage({
                type: 'SAVE_GAME_RESULT',
                success: false,
                error: String(error)
              });
            }
            break;

          case 'GET_RECENT_GAMES':
            try {
              console.log('Getting recent games');
              const result = await getRecentGames(event.data || {}, context);
              
              postMessage({
                type: 'GET_RECENT_GAMES_RESULT',
                success: true,
                result
              });
            } catch (error) {
              console.error('Error getting recent games:', error);
              postMessage({
                type: 'GET_RECENT_GAMES_RESULT',
                success: false,
                error: String(error)
              });
            }
            break;

          case 'GET_GAME':
            try {
              console.log('Getting game:', event.data.gameId);
              const result = await getGame(event.data, context);
              
              postMessage({
                type: 'GET_GAME_RESULT',
                success: true,
                result
              });
            } catch (error) {
              console.error('Error getting game:', error);
              postMessage({
                type: 'GET_GAME_RESULT',
                success: false,
                error: String(error)
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