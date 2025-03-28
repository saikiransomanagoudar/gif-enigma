import { Devvit, Context, useWebView, useState, useAsync } from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { searchTenorGifs } from '../game/server/tenorApi.server.js';
import {
  saveGame,
  getUserGames,
  getGame,
  getUnplayedGames,
  getGameState,
  saveGameState,
  getRandomGame,
  postCompletionComment,
  hasUserCompletedGame,
} from '../game/server/gameHandler.server.js';
import { Page } from '../game/lib/types.js';
import {
  fetchGeminiRecommendations,
  fetchGeminiSynonyms,
} from '../game/server/geminiApi.server.js';
import { CustomPostPreview } from './components/CustomPostPreview.js';
import { GamePostPreview } from './components/GamePostPreview.js';
import {
  saveScore,
  getGameLeaderboard,
  getGlobalLeaderboard,
  getUserScores,
  calculateScore,
  getCumulativeLeaderboard,
} from '../game/server/scoringService.js';

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
  name: 'giftest01',
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
    const retrieveNavigationState = async (): Promise<{ page: Page | null; gameId?: string }> => {
      console.log('[DEBUG-STORAGE] Retrieving navigation state');

      try {
        const navStateKey = `navState:${context.postId || 'default'}`;
        const storedState = await context.redis.hGetAll(navStateKey);

        if (storedState && storedState.page) {
          console.log('[DEBUG-STORAGE] Retrieved navigation state:', storedState);
          return {
            page: storedState.page as Page,
            gameId: storedState.gameId ?? null,
          };
        }
      } catch (error) {
        console.error('[DEBUG-STORAGE] Error retrieving navigation state:', error);
      }

      console.log('[DEBUG-STORAGE] No stored navigation state found');
      return { page: null };
    };

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

          if (storedState && storedState.page) {
            console.log('[DEBUG-STORAGE] Retrieved navigation state:', storedState);
            return {
              page: storedState.page as Page,
              gameId: storedState.gameId,
            };
          }
        } catch (redisError) {
          console.error('[DEBUG-STORAGE] Redis error in useAsync:', redisError);
          // Don't throw - return a default instead
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

    const refreshCumulativeLeaderboard = () => {
      setCumulativeLeaderboardRefreshTrigger((prev) => prev + 1);
    };

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

          // Also add this case to pass back the preloaded data to the client when requested
          // case 'GET_INITIAL_DATA':
          //   try {
          //     console.log('Sending initial data to client');

          //     // Send all the preloaded data together
          //     postMessage({
          //       type: 'INITIAL_DATA_RESULT',
          //       success: true,
          //       data: {
          //         username: username || null,
          //         randomGame: randomGameData?.success ? randomGameData.game : null,
          //         cumulativeLeaderboard: cumulativeLeaderboardData?.leaderboard || [],
          //         // Include other cached data as needed
          //       },
          //     });
          //   } catch (error) {
          //     console.error('Error sending initial data:', error);
          //     postMessage({
          //       type: 'INITIAL_DATA_RESULT',
          //       success: false,
          //       error: String(error),
          //     });
          //   }
          //   break;
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
                      numHints: commentData.numHints || 0,
                      otherGuesses: commentData.otherGuesses || [],
                      redditPostId,
                    },
                    context
                  );
                } catch (commentError) {
                  console.error('❌ [DEBUG] Error posting completion comment:', commentError);
                  // Don't fail the whole operation if commenting fails
                }
              }

              // Trigger a refresh of the UI
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
                  console.log('[DEBUG-NAV] main.tsx: Stored new navigation state:', targetPage, targetGameId);
                } catch (storeError) {
                  console.error('[DEBUG-NAV] Error storing navigation state:', storeError);
                }
            
                // Send navigation response
                const navResponse: BlocksToWebviewMessage = {
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: targetPage,
                    ...(targetGameId ? { gameId: targetGameId } : {})
                  }
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
