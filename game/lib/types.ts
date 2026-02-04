export type GameFlowState = 'loading' | 'playing' | 'won' | 'lost' | 'completed' | 'error';
export type Page = 'landing' | 'category' | 'create' | 'game' | 'howToPlay' | 'leaderboard' | 'gameResults';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Expert';

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
  hasGivenUp?: boolean;
  isCreator?: boolean; // Flag to indicate this user created the game
}

export interface GameData {
  id: string;
  word: string;
  maskedWord: string;
  category?: string;
  difficulty?: DifficultyLevel;
  questionText: string;
  gifs: string[];
  createdAt?: string;
  username?: string;
  redditPostId?: string;
  preview?: GamePreviewData;
  isChatPost?: boolean;
  acceptedSynonyms?: string[]; // Same-length semantic synonyms for validation
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
  gamesCreated: number;
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
  gamesCreated?: number;
  bestScore?: number;
  totalScore?: number;
  averageScore?: number;
  snoovatarUrl?: string;
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
  gifDescriptions?: string[]; // GIF content descriptions for validation
  searchTerms?: string[]; // Search terms used for each GIF
  postToSubreddit?: boolean;
  previewStyle?: 'basic' | 'enhanced';
  isChatPost?: boolean;
  inputType?: 'word' | 'phrase';
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
  bonusAwarded?: boolean;
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

export interface GiphyGifResult {
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

export interface GuessData {
  guess: string;
  count: number;
  percentage: number;
}

export interface GameStatistics {
  gameId: string;
  answer: string;
  totalPlayers: number;
  totalGuesses: number;
  guesses: GuessData[];
  creatorUsername?: string;
  acceptedSynonyms?: string[];
  playerScore?: number;
}

export interface GetGameStatisticsResponse {
  success: boolean;
  statistics?: GameStatistics;
  error?: string;
}