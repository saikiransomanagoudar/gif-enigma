export type Page =
  | "home"
  | "create"
  | "game"
  | "howToPlay"
  | "leaderboard";

export type WebviewToBlockMessage =
  | { type: "INIT" }
  | { type: "webViewReady" }
  | {
      type: "setCounter";
      data: { newCounter: number }
    }
  | {
      type: "createGame";
      payload: {
        title: string;
        category: string;
        difficulty: string;
      }
    }
  | {
      type: "submitGuess";
      payload: {
        gameId: string;
        guess: string;
      }
    }
  | {
      type: "SEARCH_TENOR_GIFS";
      data: {
        query: string;
        limit?: number;
        contentfilter?: string;
        media_filter?: string;
      }
    }
  | {
      type: "SEARCH_GIFS";
      data: {
        query: string;
        limit?: number;
      }
    }
  | {
      type: "SAVE_GAME";
      data: {
        word: string;
        maskedWord: string;
        questionText: string;
        gifs: string[];
        postToSubreddit?: boolean;
      }
    }
  | {
      type: "GET_RECENT_GAMES";
      data?: {
        limit?: number;
      }
    }
  | {
      type: "GET_GAME";
      data: {
        gameId: string;
      }
    };

export type BlocksToWebviewMessage =
  | {
      type: "INIT_RESPONSE";
      payload: {
        postId: string;
      }
    }
  | {
      type: "initialData";
      data: {
        username: string;
        currentCounter: number;
      }
    }
  | {
      type: "gameCreated";
      payload: {
        gameId: string;
        title: string;
        gifUrl: string;
      }
    }
  | {
      type: "guessResult";
      payload: {
        correct: boolean;
        score: number;
        message: string;
      }
    }

  | {
      type: "SEARCH_TENOR_GIFS_RESULT";
      success: boolean;
      results?: any[];
      next?: string;
      error?: string;
    }

  | {
      type: "SEARCH_GIFS_RESULT";
      success: boolean;
      results?: any[];
      error?: string;
    }
  | {
      type: "SAVE_GAME_RESULT";
      success: boolean;
      result?: any;
      error?: string;
    }
  | {
      type: "GET_RECENT_GAMES_RESULT";
      success: boolean;
      result?: any;
      error?: string;
    }
  | {
      type: "GET_GAME_RESULT";
      success: boolean;
      result?: any;
      error?: string;
    };

// Devvit message wrapper type
export type DevvitMessage = {
  type: "devvit-message";
  data: { message: BlocksToWebviewMessage };
};