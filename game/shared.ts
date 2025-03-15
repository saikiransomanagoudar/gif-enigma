// Define the pages in your GIF-Enigma game
export type Page =
  | "home"
  | "create"
  | "game"
  | "howToPlay"
  | "leaderboard";

// Messages from web view to Devvit blocks
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
  // Add RPC call type
  | {
      type: "RPC_CALL";
      id: number;
      functionName: string;
      params: any;
    };

// Messages from Devvit blocks to web view
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
  // Add RPC response types
  | {
      type: "RPC_RESPONSE";
      id: number;
      result: any;
    }
  | {
      type: "RPC_ERROR";
      id: number;
      error: string;
    };

// Devvit message wrapper type
export type DevvitMessage = {
  type: "devvit-message";
  data: { message: BlocksToWebviewMessage };
};