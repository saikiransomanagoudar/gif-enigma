import { GameData, Page } from './lib/types';
import { LeaderboardEntry } from './lib/types';

export type CategoryType = 'Movies' | 'Gaming' | 'Books' | 'General';

export type WebviewToBlockMessage =
  | { type: 'INIT' }
  | { type: 'webViewReady' }
  | { type: 'requestNavigationState' }
  | {
      type: 'setCounter';
      data: { newCounter: number };
    }
  | {
      type: 'createGame';
      data: {
        title: string;
        category: string;
        difficulty: string;
      };
    }
  | {
      type: 'submitGuess';
      data: {
        gameId: string;
        guess: string;
      };
    }
  // | {
  //     type: 'NAVIGATION';
  //     page: Page;
  //     gameId?: string;
  //   }
  | { type: 'GET_SUBREDDIT_SETTINGS' }
  | { type: 'GET_CURRENT_USER' }
  | { type: 'GET_USER_BY_ID'; data: { userId: string } }
  | { type: 'GET_USER_GAMES'; data: { userId: string; limit?: number } }
  | {
      type: 'GET_GEMINI_RECOMMENDATIONS';
      data: { category: string; inputType: 'word' | 'phrase'; count?: number };
    }
  | { type: 'GET_GEMINI_SYNONYMS'; data: { word: string } }
  | {
      type: 'SEARCH_TENOR_GIFS';
      data: {
        query: string;
        limit?: number;
        contentfilter?: string;
        media_filter?: string;
      };
    }
  | { type: 'GET_TOP_SCORES' }
  | {
      type: 'SAVE_GAME';
      data: {
        word: string;
        maskedWord: string;
        category: string;
        questionText: string;
        gifs: string[];
        postToSubreddit?: boolean;
      };
    }
  | {
      type: 'GET_GAME';
      data: {
        gameId: string;
      };
    }
  | { type: 'CACHE_GIF_RESULTS'; data: { query: string; results: any[] } }
  | { type: 'GET_CACHED_GIF_RESULTS'; data: { query: string } }
  | { type: 'GET_PLAYABLE_GAME' }
  | { type: 'GET_RANDOM_GAME'; data: { excludeIds?: string[] } }
  | {
      type: 'SAVE_GAME_STATE';
      data: {
        userId: string;
        gameId: string;
        gifHintCount: number;
        revealedLetters: number[];
        guess: string;
      };
    }
  | { type: 'GET_GAME_STATE'; data: { userId: string; gameId: string } }
  | {
      type: 'CALCULATE_SCORE';
      data: {
        word: string;
        gifHintCount: number;
        revealedLetterCount: number;
        timeTaken: number;
      };
    }
  | {
      type: 'SAVE_SCORE';
      data: {
        username: string;
        gameId: string;
        score: number;
        gifPenalty: number;
        wordPenalty: number;
        timeTaken: number;
        timestamp: number;
      };
    }
  | { type: 'GET_GAME_LEADERBOARD'; data: { gameId: string; limit?: number } }
  | {
      type: 'GET_GAME_PREVIEW_DATA';
      data: {
        gameId: string;
      };
    }
  | {
      type: 'UPDATE_POST_PREVIEW';
      data: {
        postId: string;
        maskedWord: string;
        gifs: string[];
      };
    }
  | {
      type: 'NAVIGATE';
      data: {
        page: Page;
        params?: {
          gameId?: string;
          [key: string]: any;
        };
      };
    }
  | {
      type: 'GET_GAME_PREVIEW';
    }
  | {
      type: 'MARK_GAME_COMPLETED';
      data: {
        gameId: string;
        username: string;
        commentData?: {
          numGuesses: number;
          gifHints: number;
          wordHints: number;
          hintTypeLabel: string;
        };
      };
    }
  | {
      type: 'POST_COMPLETION_COMMENT';
      data: {
        gameId: string;
        username: string;
        numGuesses: number;
        gifHints: number;
      };
    }
  | {
      type: 'HAS_USER_COMPLETED_GAME';
      data: {
        gameId: string;
        username: string;
      };
    }
  | { type: 'REFRESH_POST_PREVIEW'; data?: { gameId?: string } }
  | { type: 'GET_CUMULATIVE_LEADERBOARD'; data: { limit?: number } }
  | {
      type: 'GET_GLOBAL_LEADERBOARD';
      data?: {
        limit?: number;
      };
    }
  | { type: 'NAVIGATE_TO_POST'; data: { postId: string } }
  | { type: 'GET_RANDOM_POST'; data?: { excludeIds?: string[] } }
  | {
      type: 'GET_USER_STATS';
      data: {
        username: string;
      };
    }
  | { type: 'GET_INITIAL_DATA' }
  | {
      type: 'GET_UNPLAYED_GAMES';
      data: {
        username: string;
        limit?: number;
      };
    }
  | {
      type: 'TRACK_GUESS';
      data: {
        gameId: string;
        username: string;
        guess: string;
      };
    }
  | {
      type: 'GET_GAME_STATISTICS';
      data: {
        gameId: string;
      };
    };

export type BlocksToWebviewMessage =
  | {
      type: 'INIT_RESPONSE';
      data: {
        postId: string;
        desiredPage?: Page;
      };
    }
  | {
      type: 'SET_NAVIGATION_STATE';
      data: {
        page: Page;
        gameId?: string;
      };
    }
  | {
      type: 'initialData';
      data: {
        username: string;
        currentCounter: number;
      };
    }
  | {
      type: 'gameCreated';
      data: {
        gameId: string;
        title: string;
        gifUrl: string;
      };
    }
  | {
      type: 'guessResult';
      data: {
        correct: boolean;
        score: number;
        message: string;
      };
    }
  | {
      type: 'GET_CURRENT_USER_RESULT';
      success: boolean;
      user?: { username: string };
      error?: string;
    }
  | {
      type: 'GET_RANDOM_POST_RESULT';
      success: boolean;
      postId?: string;
      gameId?: string;
      error?: string;
    }
  | {
      type: 'GET_USER_GAMES_RESULT';
      success: boolean;
      games?: GameData[];
      message?: string;
      error?: string;
    }
  | {
      type: 'GET_GEMINI_RECOMMENDATIONS_RESULT';
      success: boolean;
      result?: string[];
      error?: string;
    }
  | {
      type: 'GET_GEMINI_SYNONYMS_RESULT';
      success: boolean;
      result?: string[][];
      word?: string;
      error?: string;
    }
  | {
      type: 'SEARCH_TENOR_GIFS_RESULT';
      success: boolean;
      results?: any[];
      next?: string;
      error?: string;
    }
  | {
      type: 'SEARCH_GIFS_RESULT';
      success: boolean;
      results?: any[];
      error?: string;
    }
  | {
      type: 'SAVE_GAME_RESULT';
      success: boolean;
      result?: {
        success: boolean;
        gameId?: string;
        postedToReddit?: boolean;
        redditPostId?: string;
        error?: string;
      };
      error?: string;
    }
  | {
      type: 'GET_GAME_RESULT';
      success: boolean;
      result?: { success: boolean; game?: GameData; error?: string };
      game?: GameData;
      error?: string;
    }
  | {
      type: 'CACHE_GIF_RESULTS_RESULT';
      success: boolean;
      error?: string;
    }
  | {
      type: 'GET_CACHED_GIF_RESULTS_RESULT';
      success: boolean;
      cached?: boolean;
      results?: any[];
      error?: string;
    }
  | {
      type: 'GET_PLAYABLE_GAME_RESULT';
      success: boolean;
      game?: GameData;
      error?: string;
      needsRandomGame?: boolean;
    }
  | {
      type: 'GET_RANDOM_GAME_RESULT';
      success: boolean;
      result?: { success: boolean; game?: GameData; error?: string };
      error?: string;
    }
  | {
      type: 'SAVE_GAME_STATE_RESULT';
      success: boolean;
      error?: string;
    }
  | {
      type: 'GET_GAME_STATE_RESULT';
      success: boolean;
      state?: {
        gifHintCount: number;
        revealedLetters: number[];
        guess: string;
        lastPlayed: string;
      };
      error?: string;
    }
  | {
      type: 'CALCULATE_SCORE_RESULT';
      success: boolean;
      result?: {
        score: number;
        gifPenalty: number;
        wordPenalty: number;
        timeTaken: number;
      };
      error?: string;
    }
  | {
      type: 'SAVE_SCORE_RESULT';
      success: boolean;
      error?: string;
    }
  | {
      type: 'GET_GAME_LEADERBOARD_RESULT';
      success: boolean;
      result?: {
        leaderboard: Array<{
          rank?: number;
          userId: string;
          username: string;
          score: number;
          gifPenalty: number;
          wordPenalty: number;
          timeTaken: number;
          timestamp: number;
        }>;
      };
      error?: string;
    }
  | {
      type: 'GAME_PREVIEW_DATA_RESULT';
      success: boolean;
      data?: {
        maskedWord: string;
        gifs: string[];
      };
      error?: string;
    }
  | {
      type: 'POST_PREVIEW_UPDATED';
      success: boolean;
      postId?: string;
      error?: string;
    }
  // | {
  //     type: 'NAVIGATION';
  //     page: Page;
  //     gameId?: string;
  //   }
  | {
      type: 'NAVIGATION_RESULT';
      success: boolean;
      page?: Page;
      gameId?: string;
      error?: string;
    }
  | {
      type: 'GET_GAME_PREVIEW_RESULT';
      success: boolean;
      preview?: {
        gameId: string;
        maskedWord?: string;
        gifs?: string[];
      };
      error?: string;
    }
  | {
      type: 'MARK_GAME_COMPLETED_RESULT';
      success: boolean;
      error?: string;
    }
  | {
      type: 'GET_CUMULATIVE_LEADERBOARD_RESULT';
      success: boolean;
      result?: {
        leaderboard: Array<{
          rank?: number;
          username: string;
          score: number;
          gamesPlayed?: number;
          gamesWon?: number;
          bestScore?: number;
          averageScore?: number;
          timestamp: number;
        }>;
        isCached?: boolean;
      };
      error?: string;
    }
  | {
      type: 'INITIAL_DATA_RESULT';
      success: boolean;
      data?: {
        username: string | null;
        randomGame: GameData | null;
        cumulativeLeaderboard: Array<{
          rank?: number;
          username: string;
          score: number;
          gamesPlayed?: number;
          gamesWon?: number;
          bestScore?: number;
          averageScore?: number;
          timestamp: number;
        }>;
      };
      error?: string;
    }
  | { type: 'MARK_GAME_COMPLETED_RESULT'; success: boolean; error?: string }
  | { type: 'REFRESH_POST_PREVIEW_RESULT'; success: boolean; error?: string }
  | {
      type: 'POST_COMPLETION_COMMENT_RESULT';
      success: boolean;
      alreadyPosted?: boolean;
      error?: string;
    }
  | {
      type: 'HAS_USER_COMPLETED_GAME_RESULT';
      success: boolean;
      completed: boolean;
      error?: string;
    }
  | {
      type: 'GET_GLOBAL_LEADERBOARD_RESULT';
      success: boolean;
      result?: {
        leaderboard: LeaderboardEntry[];
      };
      error?: string;
    }
  | {
      type: 'GET_CUMULATIVE_LEADERBOARD_RESULT';
      success: boolean;
      result?: {
        leaderboard: LeaderboardEntry[];
        isCached?: boolean;
      };
      error?: string;
    }
  | {
      type: 'GET_USER_STATS_RESULT';
      success: boolean;
      stats?: any;
      rank?: number;
      error?: string;
    }
  | {
      type: 'GET_TOP_SCORES_RESULT';
      success: boolean;
      scores?: {
        username: string;
        bestScore: number;
      }[];
      error?: string;
    }
  | {
      type: 'GET_UNPLAYED_GAMES_RESULT';
      success: boolean;
      games?: GameData[];
      error?: string;
    }
  | {
      type: 'NAVIGATE';
      data: {
        page: Page;
        params?: {
          gameId?: string;
          [key: string]: any;
        };
      };
    }
    | {
      type: 'SUBREDDIT_SETTINGS';
      data: {
        allOriginalContent: boolean;
        allowChatPostCreation: boolean;
      };
    }
    | {
      type: 'GET_SUBREDDIT_SETTINGS_RESULT';
      success: boolean;
      settings?: {
        allOriginalContent: boolean;
        allowChatPostCreation: boolean;
      };
      error?: string;
    }
    | {
      type: 'TRACK_GUESS_RESULT';
      success: boolean;
      error?: string;
    }
    | {
      type: 'GET_GAME_STATISTICS_RESULT';
      success: boolean;
      statistics?: {
        gameId: string;
        answer: string;
        totalPlayers: number;
        totalGuesses: number;
        guesses: Array<{
          guess: string;
          count: number;
          percentage: number;
        }>;
      };
      error?: string;
    };

export type DevvitMessage = {
  type: 'devvit-message';
  data: { message: BlocksToWebviewMessage };
};
