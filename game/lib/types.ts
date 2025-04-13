export type GameFlowState = 'loading' | 'playing' | 'won' | 'lost' | 'completed' | 'error';
export type Page = 'landing' | 'category' | 'create' | 'game' | 'howToPlay' | 'leaderboard';

export interface GameRedisData {
  id: string;
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string | string[];
  createdAt?: string;
  creatorId?: string;
  redditPostId?: string;
  preview?: GamePreviewData;
  [key: string]: any;
}

export interface PlayerGameState {
  gifHintCount: number;
  revealedLetters: number[];
  guess: string;
  lastPlayed: number;
  isCompleted: boolean;
}

export interface GameData {
  id: string;
  word: string;
  maskedWord: string;
  category?: string;
  questionText: string;
  gifs: string[];
  createdAt?: string;
  username?: string;
  redditPostId?: string;
  preview?: GamePreviewData;
  isChatPost?: boolean;
}

export interface GamePreviewData {
  maskedWord: string;
  gifUrls: string[];
  lastUpdated: number;
  postId?: string;
  username?: string;
}

export interface Question {
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  currentGifIndex: number;
  [key: string]: any;
}

export interface GameSessionData {
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  maxScore: number;
  state: PlayerGameState;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
  averageScore: number;
  totalScore: number;
  hintsUsed: number;
  lastPlayed?: number;
  [key: string]: any;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  rank?: number;
  gifPenalty?: number;
  wordPenalty?: number;
  timeTaken?: number;
  timestamp: number;
  gamesPlayed?: number;
  gamesWon?: number;
  bestScore?: number;
  totalScore?: number;
  averageScore?: number;
}

export interface PostCommentResponse {
  success: boolean;
  alreadyPosted?: boolean;
  error?: string;
}

export interface CreatorData {
  word: string;
  maskedWord?: string | null;
  category?: string | null;
  questionText?: string | null;
  gifs: string[];
  postToSubreddit?: boolean;
  previewStyle?: 'basic' | 'enhanced';
  isChatPost?: boolean;
}

export interface SubredditSettings {
  allOriginalContent: boolean;
  allowChatPostCreation: boolean;
}

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

export interface GetGameResponse {
  success: boolean;
  game?: GameData;
  error?: string;
}

export interface SaveGameResponse {
  success: boolean;
  gameId?: string;
  postedToReddit?: boolean;
  redditPostId?: string;
  error?: string;
  settings?: {
    isOriginalContent: boolean;
    isChatPost: boolean;
  };
}

export interface GifCacheResponse {
  success: boolean;
  cached?: boolean;
  results?: any[];
  error?: string;
  expiration?: number;
}

export interface ScoreData {
  username: string;
  gameId: string;
  score: number;
  gifPenalty: number;
  wordPenalty: number;
  timeTaken: number;
  timestamp: number;
}

export interface NavigationProps {
  onNavigate: (page: Page, params?: any) => void;
  params?: any;
  context?: any;
}

export interface PostPreviewUpdate {
  postId: string;
  gameId: string;
  preview: GamePreviewData;
  status?: 'pending' | 'published' | 'archived';
}

export interface TenorGifResult {
  id: string;
  url: string;
  media_formats: Record<string, { url: string }>;
  content_description: string;
}

export interface PreviewMessagePayload {
  type: 'previewUpdate' | 'previewRequest';
  data: {
    gameId: string;
    postId?: string;
    maskedWord?: string;
    gifUrls?: string[];
  };
}

export interface GameStateMessage {
  type: 'gameStateUpdate';
  data: PlayerGameState & { gameId: string };
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: number;
  timestamp?: number;
}

export type APIResponse<T = any> = 
  | { success: true; data: T }
  | ErrorResponse;

export function isGameData(obj: any): obj is GameData {
  return obj && typeof obj === 'object' && 'word' in obj && 'gifs' in obj;
}

export function isPreviewData(obj: any): obj is GamePreviewData {
  return obj && typeof obj === 'object' && 'maskedWord' in obj && 'gifUrls' in obj;
}

export function isLeaderboardEntry(obj: any): obj is LeaderboardEntry {
  return obj && typeof obj === 'object' && 'username' in obj && 'score' in obj;
}