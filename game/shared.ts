import { GameData, Page } from './lib/types';

// export interface GetRecentGamesResultMessage {
//   type: 'GET_RECENT_GAMES_RESULT';
//   success: boolean;
//   result?: any;
//   error?: string;
//   games?: any[];
// }

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
  | {
      type: 'NAVIGATION';
      page: Page;
      gameId?: string;
    }
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
  | {
      type: 'SAVE_GAME';
      data: {
        word: string;
        maskedWord: string;
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
      success: boolean;
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
  | {
      type: 'NAVIGATION';
      page: Page;
      gameId?: string;
    }
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
    };

export type DevvitMessage = {
  type: 'devvit-message';
  data: { message: BlocksToWebviewMessage };
};
