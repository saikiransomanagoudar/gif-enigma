import {
  Devvit,
  Context,
  useWebView,
  useState,
  useAsync,
} from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { searchTenorGifs, searchMultipleTenorGifs } from '../game/server/tenorApi.server.js';
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
  trackGuess,
  getGameStatistics,
  validateGuess,
} from '../game/server/gameHandler.server.js';

// Helper function for navigation to post
export async function navigateToPost(postId: string, context: Context) {
  if (!postId) {
    return;
  }

  // Make sure the postId has the proper format (add t3_ prefix if missing)
  const formattedPostId = postId.startsWith('t3_')
    ? postId
    : `t3_${postId}`;

  try {
    // Method 1: Get the post object using Reddit API
    const post = await context.reddit.getPostById(formattedPostId);

    if (post) {
      if (post.url) {
        context.ui.navigateTo(post.url);
      } else if (post.permalink) {
        // Fallback to permalink if url is not available
        const fullUrl = `https://www.reddit.com${post.permalink}`;
        context.ui.navigateTo(fullUrl);
      } else {
        throw new Error('Post URL and permalink both missing');
      }
    } else {
      throw new Error('Post not found');
    }
  } catch (error) {
    // Fallback method: Construct the URL directly
    // Clean the postId (remove t3_ prefix if present)
    const cleanPostId = postId.replace('t3_', '');
    // Get the current subreddit
    const subreddit = await context.reddit.getCurrentSubreddit();
    const subredditName = subreddit?.name || 'PlayGIFEnigma';

    const postUrl = `https://www.reddit.com/r/${subredditName}/comments/${cleanPostId}/`;

    context.ui.navigateTo(postUrl);
  }
}
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
  {
    name: 'enableAutoCron',
    label: 'Enable Auto-Create Cron (Prod only)',
    type: 'boolean',
    defaultValue: false,
    helpText: 'When enabled, schedules the hourly auto_create_post job. Leave OFF in playtests.',
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
    const [isWebViewReady, setIsWebViewReady] = useState(false);
    const [postPreviewRefreshTrigger, setPostPreviewRefreshTrigger] = useState(0);
    const storeNavigationState = async (page: Page, gameId?: string) => {
      const navStateKey = `navState:${context.postId || 'default'}`;
      // Store navigation data
      await context.redis.hSet(navStateKey, {
        page,
        ...(gameId ? { gameId } : {}),
      });
    };
    // Function to retrieve navigation state
    const { data: username } = useAsync(
      async () => {
        return (await context.reddit.getCurrentUsername()) ?? null;
      },
      {
        depends: [],
      }
    );

    const { data: navigationState } = useAsync(
      async () => {
        try {
          const navStateKey = `navState:${context.postId || 'default'}`;
          const storedState = await context.redis.hGetAll(navStateKey);

          if (storedState?.page) {
            return {
              page: storedState.page as Page,
              gameId: storedState.gameId,
            };
          }
          return { page: 'landing' as Page, gameId: null };
        } catch (error) {
          return { page: 'landing' as Page, gameId: null };
        }
      },
      {
        depends: [context.postId || 'default'],
      }
    );

    // @ts-ignore
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      onMessage: async (rawMessage: WebviewToBlockMessage) => {
        let event: any;
        const messageAny = rawMessage as any;
        if (context.postId && messageAny.data?.gameId) {
          const postGameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
          if (postGameId !== messageAny.data.gameId) {
            return;
          }
        }
        if (messageAny?.type === 'devvit-message') {
          if (messageAny.data?.type === 'devvit-message' && messageAny.data?.message) {
            // Double-wrapped scenario
            event = messageAny.data.message;
          } else if (messageAny.data) {
            // Single-wrapped scenario
            event = messageAny.data;
          } else {
            event = messageAny;
          }
        } else {
          event = messageAny;
        }

        switch (event.type) {
          case 'webViewReady':
            setIsWebViewReady(true);

            // Send the navigation state from useAsync
            if (navigationState) {
              const navResponse: any = {
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: navigationState.page,
                  ...(navigationState.gameId ? { gameId: navigationState.gameId } : {}),
                },
              };

              postMessage(navResponse);
            } else {
              postMessage({
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: 'landing',
                },
              });
            }
            break;

          case 'requestNavigationState':
            try {
              const navStateKey = `navState:${context.postId || 'default'}`;
              const freshState = await context.redis.hGetAll(navStateKey);

              if (freshState && freshState.page) {
                const navResponse: BlocksToWebviewMessage = {
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: freshState.page as Page,
                  },
                };

                if (freshState.gameId) {
                  (navResponse.data as any).gameId = freshState.gameId;
                }

                postMessage(navResponse);
              } else {
                postMessage({
                  type: 'SET_NAVIGATION_STATE',
                  data: {
                    page: 'landing',
                  },
                  success: true,
                } as BlocksToWebviewMessage);
              }
            } catch (error) {
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
              postMessage({
                type: 'GET_CURRENT_USER_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'CHECK_USER_COMMENT':
            try {
              if (!event.data || !event.data.gameId || !event.data.username) {
                postMessage({
                  type: 'CHECK_USER_COMMENT_RESULT',
                  success: false,
                  error: 'Missing required data: gameId and username are required',
                });
                return;
              }

              // Check Redis for existing comment
              const commentKey = `comment:${event.data.gameId}:${event.data.username}`;
              const existingComment = await context.redis.get(commentKey);

              postMessage({
                type: 'CHECK_USER_COMMENT_RESULT',
                success: true,
                hasCommented: !!existingComment,
              });
            } catch (error) {
              postMessage({
                type: 'CHECK_USER_COMMENT_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_RANDOM_GAME':
            try {
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
              postMessage({
                type: 'GET_RANDOM_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'CALCULATE_SCORE':
            try {
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
              postMessage({
                type: 'CALCULATE_SCORE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_SCORE':
            try {
              const result = await saveScore(event.data, context);

              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
              // refreshCumulativeLeaderboard();
            } catch (error) {
              postMessage({
                type: 'SAVE_SCORE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GLOBAL_LEADERBOARD':
            try {
              const result = await getGlobalLeaderboard(event.data || {}, context);
              postMessage({
                type: 'GET_GLOBAL_LEADERBOARD_RESULT',
                success: result.success,
                result: { leaderboard: result.leaderboard || [] },
                error: result.error || undefined,
              });
            } catch (error) {
              postMessage({
                type: 'GET_GLOBAL_LEADERBOARD_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_CUMULATIVE_LEADERBOARD':
            try {
              const params = event.data ? event.data : {};
              const result = await getCumulativeLeaderboard(params, context);

              postMessage({
                type: 'GET_CUMULATIVE_LEADERBOARD_RESULT',
                success: result.success,
                result: { leaderboard: result.leaderboard || [] },
                error: result.error || undefined,
              });
            } catch (error) {
              postMessage({
                type: 'GET_CUMULATIVE_LEADERBOARD_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_USER_STATS':
            try {
              if (!event.data?.username) {
                postMessage({
                  type: 'GET_USER_STATS_RESULT',
                  success: false,
                  error: 'Username is required',
                });
                return;
              }

              const username = event.data.username as string;
              let rank: number | undefined = undefined;
              // Check if user exists in the cumulative leaderboard
              const userScore = await context.redis.zScore('cumulativeLeaderboard', username);
              // Get ALL members from the cumulative leaderboard, no limit
              let members;
              try {
                members = await context.redis.zRange('cumulativeLeaderboard', 0, -1, {
                  by: 'rank',
                  reverse: true,
                });
              } catch (err) {
                members = await context.redis.zRange('cumulativeLeaderboard', 0, -1);
              }

              const orderedUsernames = members.map((m: any) => (typeof m === 'string' ? m : m.member));
              const idx = orderedUsernames.indexOf(username);
              if (idx !== -1) {
                rank = idx + 1;
              }

              // Fetch user stats hash directly; fall back to score from sorted set
              let stats: any = null;
              const userStats = (await context.redis.hGetAll(`userStats:${username}`)) || {};
              if (userStats && Object.keys(userStats).length > 0) {
                stats = {
                  username,
                  score: Number(userStats.totalScore || 0),
                  bestScore: Number(userStats.bestScore || 0),
                  averageScore: Number(userStats.averageScore || 0),
                  gamesPlayed: Number(userStats.gamesPlayed || 0),
                  gamesWon: Number(userStats.gamesWon || 0),
                  gamesCreated: Number(userStats.gamesCreated || 0),
                  timestamp: Number(userStats.lastPlayed || 0),
                };
              }

              // As a final fallback for score, read the zset score
              if (!stats || typeof stats.score !== 'number') {
                // @ts-ignore - Devvit redis supports zScore
                const zScore = await context.redis.zScore('cumulativeLeaderboard', username);
                if (!stats) stats = { username };
                stats.score = typeof zScore === 'number' ? zScore : 0;
              }

              postMessage({
                type: 'GET_USER_STATS_RESULT',
                success: true,
                stats: stats || null,
                rank,
              });
            } catch (error) {
              postMessage({
                type: 'GET_USER_STATS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_GAME_STATE':
            try {
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
              postMessage({
                type: 'SAVE_GAME_STATE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME':
            try {
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
              postMessage({
                type: 'GET_GAME_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME_STATE':
            try {
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
              postMessage({
                type: 'GET_GAME_STATE_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_UNPLAYED_GAMES':
            try {
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
              postMessage({
                type: 'GET_UNPLAYED_GAMES_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GEMINI_RECOMMENDATIONS': {
            try {
              if (!event.data) {
                throw new Error('No data received in request');
              }

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

              if (!event.data) {
                throw new Error('No data received in request');
              }

              const { word } = event.data;

              const result = await fetchGeminiSynonyms(context, word);

              postMessage({
                type: 'GET_GEMINI_SYNONYMS_RESULT',
                success: result.success,
                result: result.synonyms,
                word: word,
                error: result.error,
              } as BlocksToWebviewMessage);
            } catch (error) {
              postMessage({
                type: 'GET_GEMINI_SYNONYMS_RESULT',
                success: false,
                word: event.data?.word,
                error: String(error),
              } as BlocksToWebviewMessage);
            }
            break;
          }
          case 'SEARCH_TENOR_GIFS':
            try {
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
              postMessage({
                type: 'SEARCH_TENOR_GIFS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SEARCH_BATCH_TENOR_GIFS':
            try {
              const batchResults = await searchMultipleTenorGifs(
                context,
                event.data.queries,
                event.data.limit || 16
              );

              postMessage({
                type: 'SEARCH_BATCH_TENOR_GIFS_RESULT',
                success: true,
                results: batchResults,
              });
            } catch (error) {
              postMessage({
                type: 'SEARCH_BATCH_TENOR_GIFS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'SAVE_GAME':
            try {
              const result = await saveGame(event.data, context);     
              if (result.success && result.redditPostId) {
                setPostPreviewRefreshTrigger((prev) => prev + 1);
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
              postMessage({
                type: 'GET_TOP_SCORES_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'MARK_GAME_COMPLETED':
            try {

              if (!event.data || !event.data.gameId) {
                postMessage({
                  type: 'MARK_GAME_COMPLETED_RESULT',
                  success: false,
                  error: 'Missing required data',
                });
                return;
              }

              // Resolve a reliable username server-side. Client may send 'anonymous'.
              let resolvedUsername: string | null = null;
              const incoming = String(event.data.username || '').trim();
              if (incoming && incoming.toLowerCase() !== 'anonymous') {
                resolvedUsername = incoming.replace(/^u\//i, '');
              } else {
                const fetched = await context.reddit.getCurrentUsername();
                if (fetched) resolvedUsername = fetched;
              }

              // Create a completed player state
              const playerState = {
                gifHintCount: event.data.gifHintCount || 0,
                revealedLetters: event.data.revealedLetters || [],
                guess: event.data.finalGuess || '',
                lastPlayed: Date.now(),
                isCompleted: true,
                hasGivenUp: event.data.hasGivenUp || false,
              };

              // Save the game state as completed
              const finalUsername = resolvedUsername || event.data.username;

              const saveResult = await saveGameState(
                {
                  gameId: event.data.gameId,
                  username: finalUsername,
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
                const redditPostId = context.postId || null;
                // Post a completion comment
                await postCompletionComment(
                  {
                    gameId: event.data.gameId,
                    username: resolvedUsername || event.data.username,
                    numGuesses: commentData.numGuesses || 1,
                    gifHints: commentData.gifHints || 0,
                    wordHints: commentData.wordHints || 0,
                    hintTypeLabel: commentData.hintTypeLabel || 'letter',
                    redditPostId,
                  },
                  context
                );
              }

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
                const scoreUsername = resolvedUsername || event.data.username;

                await saveScore({
                  username: scoreUsername,
                  gameId: event.data.gameId,
                  score: scoreData.score,
                  gifPenalty: scoreData.gifPenalty,
                  wordPenalty: scoreData.wordPenalty,
                  timeTaken: scoreData.timeTaken,
                  timestamp: Date.now()
                }, context);
                
                // Clear the assigned game for this user (so they get a new random one next time)
                const assignedGameKey = `user:${scoreUsername}:assignedGame`;
                await context.redis.del(assignedGameKey);
              }

              // Send a one-time welcome/thank-you PM to the user
              const pmTarget = resolvedUsername || event.data.username;
              const pmFlagKey = `user:${pmTarget}`;
              const pmFlagField = 'welcomePMSent';
              const alreadySent = await context.redis.hGet(pmFlagKey, pmFlagField);

              if (!alreadySent) {
                const subject = 'Thanks for playing GIF Enigma!';
                const text =
                  '**Nice work decoding a GIF Enigma!** 🎉\n\n' +
                  'If you want more interesting GIF puzzles in your feed **please join us at [r/PlayGIFEnigma](https://www.reddit.com/r/PlayGIFEnigma)**.' +
                  'And, if you have any feedback or ideas, feel free to reply here or contact us via mod mail.';

                // Normalize username input and send with error handling
                const rawUsername = String(pmTarget || '').trim();
                const toUsername = rawUsername.replace(/^u\//i, '');
                try {
                  await context.reddit.sendPrivateMessage({
                    subject,
                    text,
                    to: toUsername,
                  });
                  await context.redis.hSet(pmFlagKey, { [pmFlagField]: '1' });
                } catch (pmErr: any) {
                  const errorMessage = pmErr?.details || pmErr?.message || String(pmErr);

                  if (errorMessage.includes('NOT_WHITELISTED_BY_USER_MESSAGE')) {
                    await context.redis.hSet(pmFlagKey, { [pmFlagField]: '1' });
                  }
                }
              }

              // Trigger preview refresh after game completion
              setPostPreviewRefreshTrigger((prev) => prev + 1);

              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: true,
              });
            } catch (error) {
              postMessage({
                type: 'MARK_GAME_COMPLETED_RESULT',
                success: false,
                error: String(error),
              });
            }

            break;

          case 'REFRESH_POST_PREVIEW':
            try {
              // Force a refresh of the GamePostPreview component
              setPostPreviewRefreshTrigger((prev) => prev + 1);

              postMessage({
                type: 'REFRESH_POST_PREVIEW_RESULT',
                success: true,
              });
            } catch (error) {
              postMessage({
                type: 'REFRESH_POST_PREVIEW_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'POST_COMPLETION_COMMENT':
            try {
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
                  gifHints: event.data.gifHints || 0,
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
              postMessage({
                type: 'POST_COMPLETION_COMMENT_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'HAS_USER_COMPLETED_GAME':
            try {
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
              postMessage({
                type: 'HAS_USER_COMPLETED_GAME_RESULT',
                success: false,
                error: String(error),
                completed: false,
              });
            }
            break;

          case 'NAVIGATE':
            // Extract navigation data
            const targetPage = event.data?.page;
            const targetGameId = event.data?.params?.gameId;
            if (targetPage) {
              const navStateKey = `navState:${context.postId || 'default'}`;
              await context.redis.del(navStateKey);

              // Store fresh navigation state
              await storeNavigationState(targetPage, targetGameId);

              // Send navigation response
              const navResponse: BlocksToWebviewMessage = {
                type: 'SET_NAVIGATION_STATE',
                data: {
                  page: targetPage,
                  ...(targetGameId ? { gameId: targetGameId } : {}),
                },
              };

              postMessage(navResponse);
            } else {
              postMessage({
                type: 'NAVIGATION_RESULT',
                success: false,
                error: 'Missing page in navigation request',
              } as BlocksToWebviewMessage);
            }
            break;

          case 'NAVIGATE_TO_POST':
            await navigateToPost(event.data.postId, context);
            break;

          case 'GET_RANDOM_POST':
            try {
              // Get username if provided
              const username = event.data?.username || (await context.reddit.getCurrentUsername());

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
              }

              // Get all active games from the sorted set
              const gameItems = await context.redis.zRange('activeGames', 0, -1);

              if (!gameItems || gameItems.length === 0) {
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
              const subreddit = await context.reddit.getSubredditByName('PlayGIFEnigma');

              // Create a set to store removed post IDs
              const removedPostIds = new Set<string>();
              // Get top posts
              const topPosts = await subreddit.getTopPosts();
              const allTopPosts = await topPosts.all();

              // Get edited posts
              const editedListing = await subreddit.getEdited({ type: 'post' });
              const editedPosts = await editedListing.all();

              // Get unmoderated posts
              const unmoderatedListing = await subreddit.getUnmoderated({ type: 'post' });
              const unmoderatedPosts = await unmoderatedListing.all();

              // Get mod queue posts
              const modQueueListing = await subreddit.getModQueue({ type: 'post' });
              const modQueuePosts = await modQueueListing.all();

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
                }
              }

              // Get posts removed by Automoderator from Redis
              let automoderatorRemovedIds: string[] = [];
              const zRangeResult = await context.redis.zRange('removedPosts', 0, -1);
              automoderatorRemovedIds = zRangeResult.map((item) =>
                typeof item === 'string' ? item : item.member
              );

              // Get any additional exclude IDs from the request
              const excludeIds = event.data?.excludeIds || [];

              // Store available posts with their creation dates
              const availablePostsWithDates = [];

              // Filter out games with no Reddit post ID, excluded posts, removed posts, and completed games
              for (const gameId of gameIds) {
                // Skip if this game is already completed by the user
                if (completedGameIds.includes(gameId)) {
                  continue;
                }

                // Get game data including redditPostId and createdAt
                const gameData = await context.redis.hGetAll(`game:${gameId}`);

                if (gameData && gameData.redditPostId) {
                  const postId = gameData.redditPostId;
                  const createdAt = parseInt(gameData.createdAt || '0');
                  const cleanPostId = postId.replace('t3_', '');
                  const fullPostId = postId.startsWith('t3_') ? postId : `t3_${postId}`;

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
                            continue;
                          }
                        }
                      } catch (stateError) {
                        // Continue anyway - assume not completed
                      }
                    }

                    // If we get here, the game is valid and not completed
                    availablePostsWithDates.push({
                      gameId,
                      postId: postId,
                      createdAt: createdAt,
                    });
                  }
                }
              }

              if (availablePostsWithDates.length === 0) {
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

              // Select a random post from these recent posts
              const randomIndex = Math.floor(Math.random() * recentPosts.length);
              const randomPost = recentPosts[randomIndex];

              // Final check to ensure post hasn't been removed since our filtering
              try {
                const finalCheck = await context.reddit.getPostById(
                  randomPost.postId.startsWith('t3_')
                    ? randomPost.postId
                    : `t3_${randomPost.postId}`
                );

                if (finalCheck && finalCheck.isRemoved && finalCheck.isRemoved()) {
                  postMessage({
                    type: 'GET_RANDOM_POST_RESULT',
                    success: false,
                    error: 'Selected post was found to be removed in final check',
                  });
                  return;
                }
              } catch (finalCheckError) {
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
              postMessage({
                type: 'GET_RANDOM_POST_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'GET_SUBREDDIT_SETTINGS':
            try {
              // Get the settings
              const allOriginalContent = await context.settings.get('allOriginalContent');

              const allowChatPostCreation = await context.settings.get('allowChatPostCreation');

              postMessage({
                type: 'GET_SUBREDDIT_SETTINGS_RESULT',
                success: true,
                settings: {
                  allOriginalContent: allOriginalContent === true,
                  allowChatPostCreation: allowChatPostCreation !== false,
                },
              });
            } catch (error) {
              postMessage({
                type: 'GET_SUBREDDIT_SETTINGS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'TRACK_GUESS':
            try {
              if (!event.data || !event.data.gameId || !event.data.username || !event.data.guess) {
                postMessage({
                  type: 'TRACK_GUESS_RESULT',
                  success: false,
                  error: 'Missing required data: gameId, username, and guess are required',
                });
                return;
              }

              const result = await trackGuess(event.data, context);

              postMessage({
                type: 'TRACK_GUESS_RESULT',
                success: result.success,
                error: result.error || undefined,
              });
            } catch (error) {
              postMessage({
                type: 'TRACK_GUESS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;

          case 'VALIDATE_GUESS':
            try {
              if (!event.data || !event.data.gameId || !event.data.guess) {
                postMessage({
                  type: 'VALIDATE_GUESS_RESULT',
                  success: false,
                  isCorrect: false,
                  error: 'Missing required data: gameId and guess are required',
                });
                return;
              }

              const validationResult = await validateGuess(event.data, context);

              postMessage({
                type: 'VALIDATE_GUESS_RESULT',
                success: validationResult.success,
                isCorrect: validationResult.isCorrect,
                matchType: validationResult.matchType,
                error: validationResult.error || undefined,
              });
            } catch (error) {
              postMessage({
                type: 'VALIDATE_GUESS_RESULT',
                success: false,
                isCorrect: false,
                error: String(error),
              });
            }
            break;

          case 'GET_GAME_STATISTICS':
            try {
              if (!event.data || !event.data.gameId) {
                postMessage({
                  type: 'GET_GAME_STATISTICS_RESULT',
                  success: false,
                  error: 'Missing required data: gameId is required',
                });
                return;
              }

              const result = await getGameStatistics(event.data, context);

              postMessage({
                type: 'GET_GAME_STATISTICS_RESULT',
                success: result.success,
                statistics: result.statistics,
                error: result.error || undefined,
              });
            } catch (error) {
              postMessage({
                type: 'GET_GAME_STATISTICS_RESULT',
                success: false,
                error: String(error),
              });
            }
            break;
        }
      },
    });

    const [isGame, setIsGame] = useState(false);
    const [isCheckingGameType, setIsCheckingGameType] = useState(true);

    useAsync(
      async () => {
        if (!context.postId) return false;

        // Check if this post has a game ID associated with it
        const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
        return !!gameId; // Convert to boolean
      },
      {
        depends: [context.postId ?? ''],
        finally: (result) => {
          setIsGame(!!result);
          setIsCheckingGameType(false);
        },
      }
    );
    const screenWidth = context.dimensions?.width || 0;
    const isSmallScreen = screenWidth < 420;
    const cardSize = isSmallScreen
      ? Math.floor((screenWidth || 320) * 0.4)
      : Math.floor((screenWidth || 800) * 0.25);

    return (
      <zstack height="100%" width="100%" alignment="center middle">
        {isCheckingGameType ? (
          <vstack height="100%" width="100%" alignment="center middle" darkBackgroundColor="#1A2740" lightBackgroundColor="#E8E5DA">
            <image
              url="eyebrows.gif"
              description="Loading"
              imageHeight={cardSize}
              imageWidth={cardSize}
              resizeMode="fit"
            />
          </vstack>
        ) : isGame ? (
          <GamePostPreview
            context={context}
            onMount={mount}
            postMessage={postMessage}
            isWebViewReady={isWebViewReady}
            refreshTrigger={postPreviewRefreshTrigger}
          />
        ) : (
          <CustomPostPreview
            context={context}
            onMount={mount}
            postMessage={postMessage}
            isWebViewReady={isWebViewReady}
          />
        )}
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
      title: '🎮 GIF Enigma',
      subredditName: subreddit.name,
      preview: <Preview />,
    });

    ui.showToast('Created new GIF Enigma post!');
    ui.navigateTo(post.url);
  },
});

Devvit.addMenuItem({
  label: '🔤 Trigger Word-Based Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.scheduler.runJob({
      name: 'auto_create_post',
      data: { force: true, inputType: 'word' },
      runAt: new Date(),
    });
    context.ui.showToast('✅ Triggered word-based game post!');
  },
});

Devvit.addMenuItem({
  label: '💬 Trigger Phrase-Based Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.scheduler.runJob({
      name: 'auto_create_post',
      data: { force: true, inputType: 'phrase' },
      runAt: new Date(),
    });
    context.ui.showToast('✅ Triggered phrase-based game post!');
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

Devvit.addMenuItem({
  label: '🔥 Test Cache Prewarmer (Manual)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.scheduler.runJob({
      name: 'cache_prewarmer',
      runAt: new Date(),
    });
    context.ui.showToast('✅ Triggered cache prewarmer manually!');
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '1.0.0.0';
}

export default Devvit;
