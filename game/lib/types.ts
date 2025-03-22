
export type GameState = 'loading' | 'playing' | 'won' | 'lost' | 'completed' | 'error';
export type Difficulty = 'easy' | 'medium' | 'hard';

// Individual question/game from Redis
export interface GameRedisData {
  id: string;
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string | string[]; // Can be a JSON string or parsed array
  createdAt?: string;
  creatorId?: string;
  redditPostId?: string;
  [key: string]: any; // Allow for additional Redis fields
}

// Processed game data with proper typing
export interface GameData {
  id: string;
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  createdAt?: string;
  creatorId?: string;
  creatorUsername?: string;
  redditPostId?: string;
  [key: string]: any;
}

// Individual question in a multi-question game
export interface Question {
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  currentGifIndex: number;
  [key: string]: any;
}

// Full game session data structure (for multi-question games)
export interface GameSessionData {
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  maxScore: number;
  state: GameState;
}

// User statistics
export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
  averageScore: number;
  totalScore: number;
  hintsUsed: number;
  [key: string]: any;
}

// Leaderboard entry
export interface LeaderboardEntry {
  username: string;
  gamesWon: number;
  bestScore: number;
  averageScore: number;
  bestGuessCount: number;
}

// Creator mode form data
export interface CreatorData {
  word: string;
  maskedWord?: string; // Optional - can be generated
  questionText?: string; // Optional
  gifs: string[];
  postToSubreddit?: boolean;
}

// API Response interfaces

// Response structure for getRecentGames
export interface GetRecentGamesResponse {
  success: boolean;
  games?: GameData[];
  error?: string;
  message?: string;
  debug?: {
    gamesFound: number;
    activeGamesTotal: number;
  };
}

// Response structure for getGame
export interface GetGameResponse {
  success: boolean;
  game?: GameData;
  error?: string;
}

// Response structure for saveGame
export interface SaveGameResponse {
  success: boolean;
  gameId?: string;
  postedToReddit?: boolean;
  redditPostId?: string;
  error?: string;
}

// Response structure for cacheGifResults and getCachedGifResults
export interface GifCacheResponse {
  success: boolean;
  cached?: boolean;
  results?: any[];
  error?: string;
}

// For postMessage communication
export interface PostMessageEvent<T = any> {
  type: string;
  data?: T;
  success?: boolean;
  result?: any;
  error?: string;
}

// Navigation props for component routing
export interface NavigationProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
}