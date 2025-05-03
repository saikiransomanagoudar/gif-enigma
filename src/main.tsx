import {
  Devvit,
  Context,
  useWebView,
  useState,
  useAsync,
} from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import {
  saveGame,
  getGame,
  getUnplayedGames,
  getGameState,
  saveGameState,
  getRandomGame,
  postCompletionComment,
  hasUserCompletedGame,
  removeSystemUsersFromLeaderboard,
} from '../game/server/gameHandler.server.js';
import { Page } from '../game/lib/types.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../game/server/geminiApi.server.js';
import { Preview } from './components/Preview.js';
import { CustomPostPreview } from './components/CustomPostPreview.js';
import { GamePostPreview } from './components/GamePostPreview.js';
import {
  saveScore,
  getGlobalLeaderboard,
  calculateScore,
  getCumulativeLeaderboard,
} from '../game/server/scoringService.js';
import '../game/server/autoCreateGameScheduler.js';

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
  {
    name: 'allOriginalContent',
    label: 'Require All Original Content',
    type: 'boolean',
    defaultValue: false,
  },
  {
    name: 'allowChatPostCreation',
    label: 'Allow Chat Post Creation',
    type: 'boolean',
    defaultValue: true,
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
  name: 'gif-enigma',
  height: 'tall',
  render: (context) => {
    let isWebViewReadyFlag: boolean = false;
    const [cumulativeLeaderboardRefreshTrigger, setCumulativeLeaderboardRefreshTrigger] =
      useState(0);
    const [postPreviewRefreshTrigger, setPostPreviewRefreshTrigger] = useState(0);
    const storeNavigationState = async (page: Page, gameId?: string) => {
      try {
        // Store in Redis with the post ID as part of the key
        const navStateKey = `navState:${context.postId || 'default'}`;

        // Store navigation data
        await context.redis.hSet(navStateKey, {
          page,
          ...(gameId ? { gameId } : {}),
        });

        console.log('[DEBUG-STORAGE] Navigation state stored successfully:', page, gameId);
      } catch (error) {
        console.error('[DEBUG-STORAGE] Error storing navigation state:', error);
      }
    };
    // Function to retrieve navigation state

    const { data: username } = useAsync(async () => {
      return (await context.reddit.getCurrentUsername()) ?? null;
    });

    // const {
    //   data: randomGameData,
    //   loading: randomGameLoading,
    //   error: randomGameError,
    // } = useAsync(
    //   async () => {
    //     try {
    //       const result = await getRandomGame(
    //         {
    //           excludeIds: [],
    //           preferUserCreated: true,
    //         },
    //         context
    //       );

    //       return result;
    //     } catch (error) {
    //       console.error('Error in randomGame useAsync:', error);
    //       throw error;
    //     }
    //   },
    //   {
    //     depends: [context.postId || 'default'],
    //   }
    // );

    const { data: navigationState } = useAsync(
      async () => {
        console.log('[DEBUG-STORAGE] Retrieving navigation state with useAsync');

        try {
          const navStateKey = `navState:${context.postId || 'default'}`;
          const storedState = await context.redis.hGetAll(navStateKey);

          if (storedState?.page) {
            console.log('[DEBUG-STORAGE] Retrieved navigation state:', storedState);
            return {
              page: storedState.page as Page,
              gameId: storedState.gameId,
            };
          }
        } catch (redisError) {
          console.error('[DEBUG-STORAGE] Redis error in useAsync:', redisError);
        }

        console.log('[DEBUG-STORAGE] No stored navigation state found, using default');
        return { page: 'landing' as Page, gameId: null };
      },
      {
        depends: [context.postId || 'default'],
        // Handle errors within the effect
      }
    );

    const {
      data: cumulativeLeaderboardData,
      loading: cumulativeLeaderboardLoading,
      error: cumulativeLeaderboardError,
    } = useAsync(
      async () => {
        try {
          console.log('Fetching cumulative leaderboard data...');
          const result = await getCumulativeLeaderboard({ limit: 20 }, context);
          console.log('Cumulative leaderboard data:', result);
          return result;
        } catch (error) {
          console.error('Error fetching cumulative leaderboard:', error);
          throw error;
        }
      },
      {
        depends: [cumulativeLeaderboardRefreshTrigger],
      }
    );


    // @ts-ignore
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      onMessage: async (rawMessage: WebviewToBlockMessage) => {
        console.log('[DEBUG] main.tsx onMessage received:', rawMessage);

        let event: any;
        const messageAny = rawMessage as any;
        if (context.postId && messageAny.data?.gameId) {
          console.log(`[DEBUG] Validating post ${context.postId} owns game ${messageAny.data.gameId}`);
          const postGameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
          if (postGameId !== messageAny.data.gameId) {
            console.log('[DEBUG] Rejecting stale game data');
            return;
          }
        }
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

            // Send the navigation state from useAsync
            if (navigationState) {
              const navResponse: any = {
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: navigationState.page,
                  ...(navigationState.gameId ? { gameId: navigationState.gameId } : {}),
                },
              };

              console.log(
                '[DEBUG] main.tsx: Sending navigation from useAsync:',
                JSON.stringify(navResponse)
              );
              postMessage(navResponse);
            } else {
              // Default to landing if navigation state isn't available yet
              console.log('[DEBUG] main.tsx: No navigation state available, defaulting to landing');
              postMessage({
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: 'landing',
                },
              });
            }
            break;

          case 'requestNavigationState':
            console.log('[DEBUG] main.tsx: requestNavigationState received');

            // CRITICAL FIX: Force retrieve the latest navigation state instead of using cached data
            try {
              const navStateKey = `navState:${context.postId || 'default'}`;
              const freshState = await context.redis.hGetAll(navStateKey);

              console.log('[DEBUG] main.tsx: Fresh navigation state retrieved:', freshState);

              if (freshState && freshState.page) {
                // Create a properly typed response object
                const navResponse: BlocksToWebviewMessage = {
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: freshState.page as Page,
                  },
                };

                // Add gameId if it exists
                if (freshState.gameId) {
                  // Use a type assertion to add the gameId property
                  (navResponse.data as any).gameId = freshState.gameId;
                  console.log(
                    '[DEBUG] main.tsx: Including gameId in navigation state:',
                    freshState.gameId
                  );
                }

                console.log(
                  '[DEBUG] main.tsx: Sending fresh navigation state:',
                  JSON.stringify(navResponse)
                );
                postMessage(navResponse);
              } else {
                // Default to landing if navigation state isn't available
                console.log('[DEBUG] main.tsx: No stored page found, defaulting to landing');
                postMessage({
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: 'landing',
                  },
                  success: true, // Add the required success property
                } as BlocksToWebviewMessage);
              }
            } catch (error) {
              console.error('[DEBUG] main.tsx: Error retrieving navigation state:', error);
              // Default to landing on error
              postMessage({
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: 'landing',
                },
                success: true,
              } as BlocksToWebviewMessage);
            }
            break;

          case 'INIT':
            console.log('[DEBUG-NAV] main.tsx: INIT message received');

            // Use navigationState instead of persistentPage
            const desiredPage = navigationState?.page || 'landing';
            const gameId = navigationState?.gameId;

            // Create a properly typed response
            const initResponse: any = {
              type: 'INIT_RESPONSE',
              data: {
                postId: context.postId || '',
                desiredPage,
                ...(gameId ? { gameId } : {}),
              },
            };

            console.log(
              '[DEBUG-NAV] main.tsx: Sending INIT_RESPONSE:',
              JSON.stringify(initResponse)
            );
            postMessage(initResponse);
            break;

          case 'GET_CURRENT_USER':
            try {
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

          // case 'GET_RANDOM_GAME':
          //   try {
          //     console.log('GET_RANDOM_GAME received, excludeIds:', event.data?.excludeIds);

          //     if (randomGameLoading) {
          //       postMessage({
          //         type: 'GET_RANDOM_GAME_RESULT',
          //         success: false,
          //         error: 'Game data is still loading',
          //       });
          //       return;
          //     }

          //     if (randomGameError) {
          //       // Send the error to the client
          //       postMessage({
          //         type: 'GET_RANDOM_GAME_RESULT',
          //         success: false,
          //         error: String(randomGameError),
          //       });
          //       return;
          //     }

          //     if (randomGameData && randomGameData.success && randomGameData.game) {
          //       // Send the pre-loaded random game data
          //       const gameToSend = {
          //         id: randomGameData.game.id,
          //         word: randomGameData.game.word,
          //         maskedWord: randomGameData.game.maskedWord,
          //         questionText: randomGameData.game.questionText,
          //         gifs: Array.isArray(randomGameData.game.gifs) ? randomGameData.game.gifs : [],
          //         createdAt: randomGameData.game.createdAt,
          //         username:
          //           randomGameData.game.username ||
          //           randomGameData.game.creatorUsername ||
          //           'anonymous',
          //       };
          //       console.log('Sending game with ID:', gameToSend.id);
          //       postMessage({
          //         type: 'GET_RANDOM_GAME_RESULT',
          //         success: true,
          //         result: {
          //           success: true,
          //           game: gameToSend,
          //         },
          //       });
          //     } else {
          //       // Send failure message
          //       postMessage({
          //         type: 'GET_RANDOM_GAME_RESULT',
          //         success: false,
          //         error: randomGameData?.error || 'No game found',
          //       });
          //     }
          //   } catch (error) {
          //     console.error('Error getting random game:', error);
          //     postMessage({
          //       type: 'GET_RANDOM_GAME_RESULT',
          //       success: false,
          //       error: String(error),
          //     });
          //   }
          //   break;

          case 'GET_RANDOM_GAME':
            try {
              console.log('🔍 [DEBUG] Getting random game, with params:', event.data);

              // Make sure to include username if available to filter completed games
              const params = {
                excludeIds: event.data.excludeIds || [],
                preferUserCreated: event.data.preferUserCreated !== false,
                username: event.data.username || username,
              };

              const result = await getRandomGame(params, context);

              postMessage({
                type: 'GET_RANDOM_GAME_RESULT',
                success: result.success,
                result: result,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error getting random game:', error);
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
              const scoreResult = {
                ...calculateScore(event.data),
                username: event.data.username,
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

              const result = await saveScore(event.data, context);

              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
              // refreshCumulativeLeaderboard();
            } catch (error) {
              console.error('Error saving score:', error);
              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GLOBAL_LEADERBOARD':
            try {
              console.log('MainApp: Received GET_GLOBAL_LEADERBOARD request', event.data);
              const result = await getGlobalLeaderboard(event.data || {}, context);
              console.log('MainApp: Global leaderboard fetch result:', result.success);

              postMessage({
                type: 'GET_GLOBAL_LEADERBOARD_RESULT',
                success: result.success,
                result: { leaderboard: result.leaderboard || [] },
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('MainApp: Error getting global leaderboard:', error);
              postMessage({
                type: 'GET_GLOBAL_LEADERBOARD_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_CUMULATIVE_LEADERBOARD':
            try {
              console.log('MainApp: Received GET_CUMULATIVE_LEADERBOARD request', event.data);
              const params = event.data ? event.data : {};
              const result = await getCumulativeLeaderboard(params, context);
              console.log('MainApp: Cumulative leaderboard fetch result:', result.success);

              postMessage({
                type: 'GET_CUMULATIVE_LEADERBOARD_RESULT',
                success: result.success,
                result: { leaderboard: result.leaderboard || [] },
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('MainApp: Error getting cumulative leaderboard:', error);
              postMessage({
                type: 'GET_CUMULATIVE_LEADERBOARD_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_USER_STATS':
            try {
              console.log('Getting user stats for:', event.data?.username);

              if (!event.data?.username) {
                postMessage({
                  type: 'GET_USER_STATS_RESULT',
                  success: false,
                  error: 'Username is required',
                });
                return;
              }

              // First get the user's rank in the cumulative leaderboard
              const cumulativeResult = await getCumulativeLeaderboard({ limit: 100 }, context);

              if (!cumulativeResult.success) {
                postMessage({
                  type: 'GET_USER_STATS_RESULT',
                  success: false,
                  error: cumulativeResult.error || 'Failed to fetch leaderboard data',
                });
                return;
              }

              // Find the user in the leaderboard to get their rank
              const userRank = cumulativeResult.leaderboard?.findIndex(
                (entry) => entry.username === event.data.username
              );

              // Get the user's entry if found
              const userEntry =
                userRank !== -1 && cumulativeResult?.leaderboard
                  ? cumulativeResult.leaderboard?.[userRank as number]
                  : null;

              // If user was found, include their rank
              if (userEntry) {
                if (userRank !== undefined) {
                  userEntry.rank = userRank + 1; // Convert from 0-based index to 1-based rank
                }
              }

              postMessage({
                type: 'GET_USER_STATS_RESULT',
                success: true,
                stats: userEntry || null,
                rank: userRank !== undefined && userRank !== -1 ? userRank + 1 : undefined,
              });
            } catch (error) {
              console.error('Error getting user stats:', error);
              postMessage({
                type: 'GET_USER_STATS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_GAME_STATE':
            try {
              console.log('🎲 [DEBUG] Saving game state:', event.data);

              if (
                !event.data ||
                !event.data.username ||
                !event.data.gameId ||
                !event.data.playerState
              ) {
                postMessage({
                  type: 'SAVE_GAME_STATE_RESULT',
                  success: false,
                  error: 'Missing required data',
                });
                return;
              }

              const result = await saveGameState(event.data, context);

              postMessage({
                type: 'SAVE_GAME_STATE_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error saving game state:', error);
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

              if (!event.data.gameId) {
                postMessage({
                  type: 'GET_GAME_RESULT',
                  success: false,
                  error: 'Missing gameId parameter',
                });
                return;
              }

              // Use the provided gameId to fetch the game
              const result = await getGame(
                {
                  gameId: event.data.gameId,
                },
                context
              );

              console.log('Game data retrieved:', result.success, result.game?.id);

              if (result.success && result.game) {
                postMessage({
                  type: 'GET_GAME_RESULT',
                  success: true,
                  game: result.game,
                });
              } else {
                postMessage({
                  type: 'GET_GAME_RESULT',
                  success: false,
                  error: result.error || 'Game not found',
                });
              }
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
              console.log('🎲 [DEBUG] Getting game state:', event.data);

              if (!event.data || !event.data.username || !event.data.gameId) {
                postMessage({
                  type: 'GET_GAME_STATE_RESULT',
                  success: false,
                  error: 'Missing required data',
                });
                return;
              }

              const result = await getGameState(event.data, context);

              postMessage({
                type: 'GET_GAME_STATE_RESULT',
                success: result.success,
                state: result.state,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error getting game state:', error);
              postMessage({
                type: 'GET_GAME_STATE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_UNPLAYED_GAMES':
            try {
              console.log('🔍 [DEBUG] Getting unplayed games for user:', event.data?.username);

              if (!event.data || !event.data.username) {
                postMessage({
                  type: 'GET_UNPLAYED_GAMES_RESULT',
                  success: false,
                  error: 'Username is required',
                });
                return;
              }

              const result = await getUnplayedGames(event.data, context);

              postMessage({
                type: 'GET_UNPLAYED_GAMES_RESULT',
                success: result.success,
                games: result.games || [],
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error getting unplayed games:', error);
              postMessage({
                type: 'GET_UNPLAYED_GAMES_RESULT',
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

          case 'GET_TOP_SCORES':
            try {
              console.log('[DEBUG] Received GET_TOP_SCORES request');

              const result = await getCumulativeLeaderboard({ limit: 10 }, context);

              if (!result.success || !result.leaderboard) {
                postMessage({
                  type: 'GET_TOP_SCORES_RESULT',
                  success: false,
                  error: result.error || 'Failed to fetch scores',
                });
                return;
              }

              const scores = result.leaderboard.map((entry) => ({
                username: entry.username,
                bestScore: entry.score || 0,
              }));

              postMessage({
                type: 'GET_TOP_SCORES_RESULT',
                success: true,
                scores,
              });
            } catch (error) {
              console.error('[DEBUG] Error handling GET_TOP_SCORES:', error);
              postMessage({
                type: 'GET_TOP_SCORES_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'MARK_GAME_COMPLETED':
            try {
              console.log('🏁 [DEBUG] Marking game as completed:', event.data);

              if (!event.data || !event.data.gameId || !event.data.username) {
                postMessage({
                  type: 'MARK_GAME_COMPLETED_RESULT',
                  success: false,
                  error: 'Missing required data',
                });
                return;
              }

              // Create a completed player state
              const playerState = {
                gifHintCount: event.data.gifHintCount || 0,
                revealedLetters: event.data.revealedLetters || [],
                guess: event.data.finalGuess || '',
                lastPlayed: Date.now(),
                isCompleted: true,
              };

              // Save the game state as completed
              const saveResult = await saveGameState(
                {
                  gameId: event.data.gameId,
                  username: event.data.username,
                  playerState,
                },
                context
              );

              if (!saveResult.success) {
                postMessage({
                  type: 'MARK_GAME_COMPLETED_RESULT',
                  success: false,
                  error: saveResult.error || 'Failed to save completed game state',
                });
                return;
              }

              // Additional completion data
              const commentData = event.data.commentData;

              // If we have comment data, post a completion comment
              if (commentData) {
                try {
                  const redditPostId = context.postId || null;

                  // Post a completion comment
                  await postCompletionComment(
                    {
                      gameId: event.data.gameId,
                      username: event.data.username,
                      numGuesses: commentData.numGuesses || 1,
                      gifHints: commentData.gifHints || 0,
                      wordHints: commentData.wordHints || 0,
                      hintTypeLabel: commentData.hintTypeLabel || 'letter',
                      redditPostId,
                    },
                    context
                  );
                } catch (commentError) {
                  console.error('❌ [DEBUG] Error posting completion comment:', commentError);
                  // Don't fail the whole operation if commenting fails
                }
              }

              try {
                const gameResult = await getGame({ gameId: event.data.gameId }, context);
                
                if (gameResult.success && gameResult.game && gameResult.game.word) {
                  // Calculate the score using the word from the game data
                  const scoreData = calculateScore({
                    word: gameResult.game.word,
                    gifHintCount: playerState.gifHintCount || 0,
                    revealedLetterCount: playerState.revealedLetters?.length || 0,
                    timeTaken: event.data.timeTaken || 0
                  });
                  
                  // Save the score
                  await saveScore({
                    username: event.data.username,
                    gameId: event.data.gameId,
                    score: scoreData.score,
                    gifPenalty: scoreData.gifPenalty,
                    wordPenalty: scoreData.wordPenalty,
                    timeTaken: scoreData.timeTaken,
                    timestamp: Date.now()
                  }, context);
                  
                  console.log('✅ [DEBUG] Automatically calculated and saved score:', scoreData.score);
                } else {
                  console.log('⚠️ [DEBUG] Could not retrieve game data for score calculation');
                }
              } catch (scoreError) {
                console.error('❌ [DEBUG] Error auto-calculating score:', scoreError);
                // Don't fail the operation if score calculation fails
              }

              setPostPreviewRefreshTrigger((prev) => prev + 1);

              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: true,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error marking game completed:', error);
              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: false,
                error: String(error),
              });
            }
            
            break;

          case 'REFRESH_POST_PREVIEW':
            try {
              console.log('🔄 [DEBUG] Refreshing post preview');

              // Force a refresh of the GamePostPreview component
              setPostPreviewRefreshTrigger((prev) => prev + 1);

              postMessage({
                type: 'REFRESH_POST_PREVIEW_RESULT',
                success: true,
              });
            } catch (error) {
              console.error('Error refreshing post preview:', error);
              postMessage({
                type: 'REFRESH_POST_PREVIEW_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'POST_COMPLETION_COMMENT':
            try {
              console.log('🎉 [DEBUG] Posting completion comment:', event.data);

              if (!event.data || !event.data.gameId || !event.data.username) {
                postMessage({
                  type: 'POST_COMPLETION_COMMENT_RESULT',
                  success: false,
                  error: 'Missing required data: gameId and username are required',
                });
                return;
              }

              // Use the current post ID if available
              const redditPostId = context.postId || null;

              // Call the function to post a comment
              const result = await postCompletionComment(
                {
                  gameId: event.data.gameId,
                  username: event.data.username,
                  numGuesses: event.data.numGuesses || 1,
                  numHints: event.data.numHints || 0,
                  otherGuesses: event.data.otherGuesses || [],
                  redditPostId,
                },
                context
              );

              postMessage({
                type: 'POST_COMPLETION_COMMENT_RESULT',
                success: result.success,
                alreadyPosted: result.alreadyPosted,
                error: result.error || undefined,
              });
            } catch (error) {
              console.error('Error posting completion comment:', error);
              postMessage({
                type: 'POST_COMPLETION_COMMENT_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'HAS_USER_COMPLETED_GAME':
            try {
              console.log('🔍 [DEBUG] Checking if user has completed game:', event.data);

              if (!event.data || !event.data.gameId || !event.data.username) {
                postMessage({
                  type: 'HAS_USER_COMPLETED_GAME_RESULT',
                  success: false,
                  error: 'Missing required data',
                  completed: false,
                });
                return;
              }

              // Check if the user has completed the game
              const result = await hasUserCompletedGame(event.data, context);

              postMessage({
                type: 'HAS_USER_COMPLETED_GAME_RESULT',
                success: true,
                completed: result.completed,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error checking game completion status:', error);
              postMessage({
                type: 'HAS_USER_COMPLETED_GAME_RESULT',
                success: false,
                error: String(error),
                completed: false,
              });
            }
            break;

          case 'NAVIGATE':
            console.log('[DEBUG-NAV] main.tsx: NAVIGATE message received:', JSON.stringify(event));

            // Extract navigation data
            const targetPage = event.data?.page;
            const targetGameId = event.data?.params?.gameId;

            console.log(
              `[DEBUG-NAV] main.tsx: Extracted navigation data - page: ${targetPage}, gameId: ${targetGameId}`
            );

            if (targetPage) {
              // CRITICAL FIX: Force clear any existing navigation state first
              try {
                const navStateKey = `navState:${context.postId || 'default'}`;
                await context.redis.del(navStateKey);
                console.log('[DEBUG-NAV] main.tsx: Cleared previous navigation state');
              } catch (clearError) {
                console.error('[DEBUG-NAV] Error clearing previous navigation state:', clearError);
              }

              // Store fresh navigation state
              try {
                await storeNavigationState(targetPage, targetGameId);
                console.log(
                  '[DEBUG-NAV] main.tsx: Stored new navigation state:',
                  targetPage,
                  targetGameId
                );
              } catch (storeError) {
                console.error('[DEBUG-NAV] Error storing navigation state:', storeError);
              }

              // Send navigation response
              const navResponse: BlocksToWebviewMessage = {
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: targetPage,
                  ...(targetGameId ? { gameId: targetGameId } : {}),
                },
              };

              console.log(
                '[DEBUG-NAV] main.tsx: Sending navigation response:',
                JSON.stringify(navResponse)
              );
              postMessage(navResponse);
            } else {
              console.error('[DEBUG-NAV] main.tsx: Invalid navigation request - missing page');
              postMessage({
                type: 'NAVIGATION_RESULT',
                success: false,
                error: 'Missing page in navigation request',
              } as BlocksToWebviewMessage);
            }
            break;

          case 'NAVIGATE_TO_POST':
            try {
              console.log('📱 [DEBUG] Navigating to Reddit post:', event.data.postId);

              if (!event.data.postId) {
                console.error('❌ [DEBUG] No post ID provided for navigation');
                return;
              }

              // Make sure the postId has the proper format (add t3_ prefix if missing)
              const formattedPostId = event.data.postId.startsWith('t3_')
                ? event.data.postId
                : `t3_${event.data.postId}`;

              console.log('🔍 [DEBUG] Using formatted post ID:', formattedPostId);

              try {
                // Method 1: Get the post object using Reddit API
                const post = await context.reddit.getPostById(formattedPostId);

                if (post) {
                  // Log all post properties to help with debugging
                  console.log('✅ [DEBUG] Got post object with properties:', Object.keys(post));

                  if (post.url) {
                    console.log('✅ [DEBUG] Got post URL:', post.url);
                    context.ui.navigateTo(post.url);
                  } else if (post.permalink) {
                    // Fallback to permalink if url is not available
                    const fullUrl = `https://www.reddit.com${post.permalink}`;
                    console.log('✅ [DEBUG] Using permalink instead:', fullUrl);
                    context.ui.navigateTo(fullUrl);
                  } else {
                    throw new Error('Post URL and permalink both missing');
                  }

                  console.log('✅ [DEBUG] Navigation request sent for post');
                } else {
                  throw new Error('Post not found');
                }
              } catch (error) {
                console.error('❌ [DEBUG] Error with Method 1, trying fallback:', error);

                // Fallback method: Construct the URL directly
                try {
                  // Clean the postId (remove t3_ prefix if present)
                  const cleanPostId = event.data.postId.replace('t3_', '');

                  // Get the current subreddit
                  const subreddit = await context.reddit.getSubredditByName('PlayGIFEnigma');
                  const subredditName = subreddit?.name || 'PlayGIFEnigma'; // Use your default subreddit

                  const postUrl = `https://www.reddit.com/r/${subredditName}/comments/${cleanPostId}/`;
                  console.log('✅ [DEBUG] Constructed fallback post URL:', postUrl);

                  context.ui.navigateTo(postUrl);
                  console.log('✅ [DEBUG] Navigation request sent with fallback URL');
                } catch (fallbackError) {
                  console.error('❌ [DEBUG] Fallback navigation also failed:', fallbackError);
                }
              }
            } catch (error) {
              console.error('❌ [DEBUG] Error in NAVIGATE_TO_POST handler:', error);
            }
            break;

          case 'GET_RANDOM_POST':
            try {
              console.log('🔍 [DEBUG] Getting random post, with params:', event.data);

              // Get username if provided
              const username = event.data?.username || (await context.reddit.getCurrentUsername());

              if (!username) {
                console.warn('⚠️ [DEBUG] No username available, cannot filter completed games');
              }

              // Get user's completed games if username is available
              let completedGameIds: string[] = [];
              if (username) {
                const rangeResult = await context.redis.zRange(
                  `user:${username}:completedGames`,
                  0,
                  -1,
                  {
                    by: 'score',
                  }
                );
                completedGameIds = rangeResult.map((item) =>
                  typeof item === 'string' ? item : item.member
                );
                console.log('🔍 [DEBUG] User completed games:', completedGameIds);
              }

              // Get all active games from the sorted set
              const gameItems = await context.redis.zRange('activeGames', 0, -1);
              console.log(`🔍 [DEBUG] Found ${gameItems.length} active games`);

              if (!gameItems || gameItems.length === 0) {
                console.error('❌ [DEBUG] No active games found');
                postMessage({
                  type: 'GET_RANDOM_POST_RESULT',
                  success: false,
                  error: 'No active games found',
                });
                return;
              }

              // Convert to array of game IDs
              const gameIds = gameItems.map((item) =>
                typeof item === 'string' ? item : item.member
              );

              // Get the subreddit directly
              const subreddit = await context.reddit.getSubredditByName('PlayGIFEnigma'); // Replace with your actual subreddit name

              // Get comprehensive list of posts using multiple methods
              console.log('🔍 [DEBUG] Getting comprehensive list of posts');

              // Create a set to store removed post IDs
              const removedPostIds = new Set<string>();

              // Get posts from various listings
              try {
                // Get posts from top posts
                const topPosts = await subreddit.getTopPosts();
                const allTopPosts = await topPosts.all();
                console.log('🔍 [DEBUG] Top posts count:', allTopPosts.length);

                // Get edited posts
                const editedListing = await subreddit.getEdited({ type: 'post' });
                const editedPosts = await editedListing.all();
                console.log('🔍 [DEBUG] Edited posts count:', editedPosts.length);

                // Get unmoderated posts
                const unmoderatedListing = await subreddit.getUnmoderated({ type: 'post' });
                const unmoderatedPosts = await unmoderatedListing.all();
                console.log('🔍 [DEBUG] Unmoderated posts count:', unmoderatedPosts.length);

                // Get mod queue posts
                const modQueueListing = await subreddit.getModQueue({ type: 'post' });
                const modQueuePosts = await modQueueListing.all();
                console.log('🔍 [DEBUG] Mod queue posts count:', modQueuePosts.length);

                // Combine all posts and check isRemoved status
                const allPosts = [
                  ...allTopPosts,
                  ...editedPosts,
                  ...unmoderatedPosts,
                  ...modQueuePosts,
                ];

                // Filter out removed posts
                for (const post of allPosts) {
                  // Check if the post is removed
                  if (post.isRemoved && post.isRemoved()) {
                    removedPostIds.add(post.id);
                    console.log(`🔍 [DEBUG] Post ${post.id} is marked as removed`);
                  }
                }

                console.log('🔍 [DEBUG] Total removed posts identified:', removedPostIds.size);
              } catch (error) {
                console.error('❌ [DEBUG] Error getting posts:', error);
              }

              // Get posts removed by Automoderator from Redis
              let automoderatorRemovedIds: string[] = [];
              try {
                const zRangeResult = await context.redis.zRange('removedPosts', 0, -1);
                automoderatorRemovedIds = zRangeResult.map((item) =>
                  typeof item === 'string' ? item : item.member
                );
                console.log('🔍 [DEBUG] Posts removed by Automoderator:', automoderatorRemovedIds);
              } catch (error) {
                console.error('❌ [DEBUG] Error getting automod removed posts:', error);
              }

              // Get any additional exclude IDs from the request
              const excludeIds = event.data?.excludeIds || [];

              // Store available posts with their creation dates
              const availablePostsWithDates = [];

              // Filter out games with no Reddit post ID, excluded posts, removed posts, and completed games
              for (const gameId of gameIds) {
                // Skip if this game is already completed by the user
                if (completedGameIds.includes(gameId)) {
                  console.log(`🔍 [DEBUG] Skipping completed game: ${gameId}`);
                  continue;
                }

                // Get game data including redditPostId and createdAt
                const gameData = await context.redis.hGetAll(`game:${gameId}`);

                if (gameData && gameData.redditPostId) {
                  const postId = gameData.redditPostId;
                  const createdAt = parseInt(gameData.createdAt || '0');
                  const cleanPostId = postId.replace('t3_', '');
                  const fullPostId = postId.startsWith('t3_') ? postId : `t3_${postId}`;

                  console.log(
                    `🔍 [DEBUG] Checking post ${postId} (clean: ${cleanPostId}, full: ${fullPostId})`
                  );

                  // Check exclusions with different ID formats
                  const isInExcludeList =
                    excludeIds.includes(postId) ||
                    excludeIds.includes(cleanPostId) ||
                    excludeIds.includes(fullPostId);

                  // Check if post is in the removed list with different ID formats
                  const isRemoved =
                    removedPostIds.has(postId) ||
                    removedPostIds.has(cleanPostId) ||
                    removedPostIds.has(fullPostId);

                  // Check if removed by automod with different ID formats
                  const isRemovedByAutomod = automoderatorRemovedIds.some((id) => {
                    const cleanId = id.replace('t3_', '');
                    return cleanId === cleanPostId || id === postId || id === fullPostId;
                  });

                  console.log(
                    `🔍 [DEBUG] Post ${postId} status - Excluded: ${isInExcludeList}, Removed: ${isRemoved}, Automod: ${isRemovedByAutomod}`
                  );

                  // Only proceed if the post is not excluded or removed
                  if (!isInExcludeList && !isRemoved && !isRemovedByAutomod) {
                    // Check if user has a game state for this game
                    let isCompleted = false;
                    if (username) {
                      try {
                        const gameStateKey = `gameState:${gameId}:${username}`;
                        const gameState = await context.redis.hGetAll(gameStateKey);
                        if (gameState && gameState.playerState) {
                          // Parse the player state
                          const playerState = JSON.parse(gameState.playerState);
                          isCompleted = playerState.isCompleted === true;

                          if (isCompleted) {
                            console.log(
                              `🔍 [DEBUG] Skipping game ${gameId} - user has completed it`
                            );
                            continue;
                          }
                        }
                      } catch (stateError) {
                        console.error(`❌ [DEBUG] Error checking game state: ${stateError}`);
                        // Continue anyway - assume not completed
                      }
                    }

                    // If we get here, the game is valid and not completed
                    availablePostsWithDates.push({
                      gameId,
                      postId: postId,
                      createdAt: createdAt,
                    });
                    console.log(
                      `✅ [DEBUG] Added post ${postId} for game ${gameId} to available posts (created at: ${new Date(createdAt).toISOString()})`
                    );
                  } else {
                    console.log(
                      `🚫 [DEBUG] Skipping post ${postId} - ${isInExcludeList ? 'excluded ' : ''}${isRemoved ? 'removed ' : ''}${isRemovedByAutomod ? 'automod removed' : ''}`
                    );
                  }
                }
              }

              if (availablePostsWithDates.length === 0) {
                console.error('❌ [DEBUG] No available posts found after filtering');
                postMessage({
                  type: 'GET_RANDOM_POST_RESULT',
                  success: false,
                  error: 'No available posts found after filtering',
                });
                return;
              }

              // Sort by creation date (newest first)
              availablePostsWithDates.sort((a, b) => b.createdAt - a.createdAt);

              // Take only the 10 most recent posts (or fewer if there aren't 10)
              const recentPosts = availablePostsWithDates.slice(
                0,
                Math.min(10, availablePostsWithDates.length)
              );
              console.log(`✅ [DEBUG] Using ${recentPosts.length} most recent posts for selection`);

              // Select a random post from these recent posts
              const randomIndex = Math.floor(Math.random() * recentPosts.length);
              const randomPost = recentPosts[randomIndex];

              console.log(
                '✅ [DEBUG] Selected random post:',
                randomPost.postId,
                'for game:',
                randomPost.gameId,
                'created at:',
                new Date(randomPost.createdAt).toISOString()
              );

              // Final check to ensure post hasn't been removed since our filtering
              try {
                const finalCheck = await context.reddit.getPostById(
                  randomPost.postId.startsWith('t3_')
                    ? randomPost.postId
                    : `t3_${randomPost.postId}`
                );

                if (finalCheck && finalCheck.isRemoved && finalCheck.isRemoved()) {
                  console.error(
                    `❌ [DEBUG] Final check found post ${randomPost.postId} is removed!`
                  );
                  postMessage({
                    type: 'GET_RANDOM_POST_RESULT',
                    success: false,
                    error: 'Selected post was found to be removed in final check',
                  });
                  return;
                }
              } catch (finalCheckError) {
                console.error(`❌ [DEBUG] Error in final post check:`, finalCheckError);
                // If we can't fetch the post, it might be removed/deleted
                postMessage({
                  type: 'GET_RANDOM_POST_RESULT',
                  success: false,
                  error: 'Could not verify post in final check - it may be unavailable',
                });
                return;
              }

              postMessage({
                type: 'GET_RANDOM_POST_RESULT',
                success: true,
                postId: randomPost.postId,
                gameId: randomPost.gameId,
              });
            } catch (error) {
              console.error('❌ [DEBUG] Error getting random post:', error);
              postMessage({
                type: 'GET_RANDOM_POST_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_SUBREDDIT_SETTINGS':
            try {
              console.log('Getting subreddit settings');

              // Get the current subreddit

              // Get the settings
              const allOriginalContent = await context.settings.get('allOriginalContent');

              const allowChatPostCreation = await context.settings.get('allowChatPostCreation');

              postMessage({
                type: 'GET_SUBREDDIT_SETTINGS_RESULT',
                success: true,
                settings: {
                  allOriginalContent: allOriginalContent === true,
                  allowChatPostCreation: allowChatPostCreation !== false, // Default to true if not set
                },
              });
            } catch (error) {
              console.error('Error getting subreddit settings:', error);
              postMessage({
                type: 'GET_SUBREDDIT_SETTINGS_RESULT',
                success: false,
                error: String(error),
              });
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
          finally: (result) => {
            setIsGame(!!result);
            setIsLoading(false);
            console.log('Post preview component - isGame:', !!result);
          },
        }
      );

      return isGame ? (
        <GamePostPreview
          context={context}
          onMount={mount}
          postMessage={postMessage}
          isWebViewReady={isWebViewReadyFlag}
          refreshTrigger={postPreviewRefreshTrigger}
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
  label: 'Create GIF Enigma',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    const post = await reddit.submitPost({
      title: 'GIF Enigma Game',
      subredditName: subreddit.name,
      preview: <Preview />,
    });

    ui.showToast('Created new GIF Enigma post!');
    ui.navigateTo(post.url);
  },
});

Devvit.addMenuItem({
  label: '🔁 Test Auto Game Post (Manual)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.scheduler.runJob({
      name: 'auto_create_post',
      data: undefined,
      runAt: new Date(),
    });

    context.ui.showToast('✅ Triggered auto game post manually!');
  },
});

Devvit.addMenuItem({
  label: '🧹 Clean Leaderboards',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await removeSystemUsersFromLeaderboard(context);
    context.ui.showToast('Leaderboards cleaned of system users!');
  },
});

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_event, context) => {
    const jobId = await context.scheduler.runJob({
      name: 'auto_create_post',
      cron: '0 12 * * *', // Run at 12:00 UTC every day
    });
    console.log('✅ Scheduled auto_create_post job to run once daily at 12:00 UTC:', jobId);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '1.0.0.0';
}

export default Devvit;
