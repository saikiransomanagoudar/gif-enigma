// server/saveCreatedGame.ts
import { Context } from '@devvit/public-api';
import { Question } from '../lib/types.js';

interface SaveGameParams {
  word: string;
  maskedWord: string;
  gifs: string[];
}

interface CreatedGame extends Question {
  createdBy: string;
  createdAt: string;
  [key: string]: any; // Index signature to satisfy JSONValue constraint
}

/**
 * Server-side block to save user-created games
 */
export async function saveCreatedGame(params: SaveGameParams, context: Context): Promise<boolean> {
  try {
    const { word, maskedWord, gifs } = params;
    const { reddit, kvStore } = context;
    
    // Get current user
    const currentUser = await reddit.getCurrentUser();
    if (!currentUser) {
      console.error('No user found when saving game');
      return false;
    }
    
    // Create a question object
    const newQuestion: Question = {
      word,
      maskedWord,
      gifs,
      currentGifIndex: 0
    };
    
    // Add creator information
    const createdGame: CreatedGame = {
      ...newQuestion,
      createdBy: currentUser.username,
      createdAt: new Date().toISOString()
    };
    
    // Get existing created games - ensure it's an array with proper type handling
    const existingGamesValue = await kvStore.get('createdGames');
    
    // Safe type casting with validation
    let existingGames: any[] = [];
    if (Array.isArray(existingGamesValue)) {
      existingGames = existingGamesValue;
    }
    
    // Add the new game
    existingGames.push(createdGame);
    
    // Save back to KV store
    await kvStore.put('createdGames', existingGames);
    
    // Also update the user's created games count
    const userCreatorKey = `creator:${currentUser.username}`;
    const userCreationsValue = await kvStore.get(userCreatorKey);
    
    // Safe type handling for the counter
    let userCreations = 0;
    if (typeof userCreationsValue === 'number') {
      userCreations = userCreationsValue;
    }
    
    await kvStore.put(userCreatorKey, userCreations + 1);
    
    return true;
  } catch (error) {
    console.error('Error saving created game:', error);
    return false;
  }
}