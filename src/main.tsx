import { Devvit, Context, useWebView, useState } from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import { saveGame, getUserGames } from '../game/server/gameHandler.server.js';
import { ComicText } from './utils/fonts/comicText.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../game/server/geminiApi.server.js';
import { CustomPostPreview } from './components/CustomPostPreview.js';
import { ScoreData } from '../game/server/scoringService.js';

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
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      onMessage: async (
        event: WebviewToBlockMessage,
        { postMessage }: { postMessage: (message: BlocksToWebviewMessage) => void }
      ) => {
        console.log('Received message from web app:', event.type);

        switch (event.type) {
          case 'INIT':
            postMessage({
              type: 'INIT_RESPONSE',
              data: {
                postId: context.postId || '',
              },
            });
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
              const scoreResult = calculateScore(event.data);

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
              console.log('Saving score:', event.data);
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
              const result = await saveGame(event.data, context);
              if (result.success && result.redditPostId) {
                await context.redis.hSet(`post:${result.redditPostId}`, { gameId: result.gameId! });
                await context.redis.hSet(`gamePreview:${result.gameId}`, {
                  maskedWord: event.data.maskedWord,
                  gifs: JSON.stringify(event.data.gifs),
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

          case 'NAVIGATE':
            console.log('MainApp: Navigation request', event.data);
            postMessage({
              type: 'NAVIGATION_RESULT',
              success: true,
              page: event.data.page,
              // Include gameId if it exists in params
              ...(event.data.params?.gameId ? { gameId: event.data.params.gameId } : {}),
            });
            break;

          default:
            console.error('Unknown message type', event);
            break;
        }
      },
    });

    return (
      <zstack height="100%" width="100%" alignment="center middle">
        <CustomPostPreview 
          context={context} 
          onMount={mount} 
          postMessage={postMessage} 
        />
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
    // const url1 = await context.assets.getURL('lets-play.gif');
    // const url2 = await context.assets.getURL('lets-build.gif');
    // context.ui.showToast(`GIF URLs: ${url1} and ${url2}`);
    const post = await reddit.submitPost({
      title: 'New GIF Enigma Challenge!',
      subredditName: subreddit.name,
      preview: <CustomPostPreview context={context} onMount={() => {}} postMessage={() => {}} />,
    });

    ui.showToast('Created new GIF Enigma post!');
    ui.navigateTo(post.url);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '1.0.0.0';
}

export default Devvit;
