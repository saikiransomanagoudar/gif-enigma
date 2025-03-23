export type Page = 'home' | 'create' | 'game' | 'howToPlay' | 'leaderboard';

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
  | {
      type: 'setCounter';
      data: { newCounter: number };
    }
  | {
      type: 'createGame';
      payload: {
        title: string;
        category: string;
        difficulty: string;
      };
    }
  | {
      type: 'submitGuess';
      payload: {
        gameId: string;
        guess: string;
      };
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
  // | {
  //     type: 'GET_RECENT_GAMES';
  //     data?: {
  //       limit?: number;
  //     };
  //   }
  | {
      type: 'GET_GAME';
      data: {
        gameId: string;
      };
    }
  // | {
  //     type: 'UPLOAD_TENOR_GIF';
  //     data: {
  //       tenorGifUrl: string;
  //       gifId: string;
  //     };
  //   };
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
        userId: string;
        gameId: string;
        score: number;
        gifPenalty: number;
        wordPenalty: number;
        timeTaken: number;
        timestamp: number;
      };
    }
  | { type: 'GET_GAME_LEADERBOARD'; data: { gameId: string; limit?: number } }
  | { type: 'PURGE_LEGACY_GAMES' };
  

export interface GameData {
  id: string;
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  createdAt?: string;
  creatorId?: string;
  redditPostId?: string;
}

export type BlocksToWebviewMessage =
  | {
      type: 'INIT_RESPONSE';
      payload: {
        postId: string;
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
      payload: {
        gameId: string;
        title: string;
        gifUrl: string;
      };
    }
  | {
      type: 'guessResult';
      payload: {
        correct: boolean;
        score: number;
        message: string;
      };
    }
  | {
      type: 'GET_CURRENT_USER_RESULT';
      success: boolean;
      user?: { id: string; username: string };
      error?: string;
    }
  | {
      type: 'GET_USER_BY_ID_RESULT';
      success: boolean;
      user?: { id: string; username: string };
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
  // | {
  //     type: 'GET_RECENT_GAMES_RESULT';
  //     success: boolean;
  //     result?: { success: boolean; games?: GameData[]; error?: string };
  //     games?: GameData[];
  //     error?: string;
  //   }
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
      type: 'PURGE_LEGACY_GAMES_RESULT';
      success: boolean;
      deleted?: number;
      error?: string;
    };
// | {
//     type: 'UPLOAD_TENOR_GIF_RESULT';
//     success: boolean;
//     mediaId?: string;
//     mediaUrl?: string;
//     gifId?: string;
//     error?: string;
//   };

// Devvit message wrapper type
export type DevvitMessage = {
  type: 'devvit-message';
  data: { message: BlocksToWebviewMessage };
};
