// Game state types
export type GameState = 'playing' | 'won' | 'lost' | 'completed';
export type Difficulty = 'easy' | 'medium' | 'hard';

// Individual question in a game
export interface Question {
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];  // Array of 4 GIF URLs from Tenor
  currentGifIndex: number;  // Which GIF is currently shown (0-3)
  [key: string]: any;
}

// Game data structure
export interface GameData {
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  maxScore: number;
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
  gifs: string[];
}
