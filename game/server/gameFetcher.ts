// server/gameFetcher.ts
import { Context } from '@devvit/public-api';
import { GameData, Question } from '../lib/types.js';

// Sample questions for development
const sampleQuestions: Question[] = [
  {
    word: 'REACTION',
    maskedWord: 'R___T__N',
    gifs: [
      'https://tenor.com/reaction1.gif',
      'https://tenor.com/reaction2.gif',
      'https://tenor.com/reaction3.gif',
      'https://tenor.com/reaction4.gif'
    ],
    currentGifIndex: 0,
    questionText: ''
  },
  {
    word: 'PUZZLE',
    maskedWord: 'P__Z__',
    gifs: [
      'https://tenor.com/puzzle1.gif',
      'https://tenor.com/puzzle2.gif',
      'https://tenor.com/puzzle3.gif',
      'https://tenor.com/puzzle4.gif'
    ],
    currentGifIndex: 0,
    questionText: ''
  },
  {
    word: 'KEYBOARD',
    maskedWord: 'K___O___',
    gifs: [
      'https://tenor.com/keyboard1.gif',
      'https://tenor.com/keyboard2.gif',
      'https://tenor.com/keyboard3.gif',
      'https://tenor.com/keyboard4.gif'
    ],
    currentGifIndex: 0,
    questionText: ''
  }
];

/**
 * Server-side block to fetch game data
 * In a production version, this would fetch from a database or external API
 */
export async function gameFetcher(params: any, context: Context): Promise<GameData> {
  try {
    // In a real implementation, you would fetch from KV store or external API
    // For example, to load user-created games:
    
    // const createdGames = await context.kvStore.get('createdGames') || [];
    // const randomGames = [];
    // 
    // // Randomly select 3 games
    // if (createdGames.length > 0) {
    //   // If we have enough user-created games, use those
    //   if (createdGames.length >= 3) {
    //     const shuffled = [...createdGames].sort(() => 0.5 - Math.random());
    //     randomGames = shuffled.slice(0, 3);
    //   } else {
    //     // Otherwise, use what we have and fill the rest with samples
    //     randomGames = [...createdGames];
    //     const neededCount = 3 - randomGames.length;
    //     const shuffledSamples = [...sampleQuestions].sort(() => 0.5 - Math.random());
    //     randomGames = [...randomGames, ...shuffledSamples.slice(0, neededCount)];
    //   }
    // } else {
    //   // If no user-created games exist, use samples
    //   randomGames = [...sampleQuestions];
    // }
    
    // For now, return the sample questions
    return {
      questions: sampleQuestions,
      currentQuestionIndex: 0,
      score: 100,
      maxScore: 100
    };
    
  } catch (error) {
    console.error('Error fetching game data:', error);
    // Return default game data if there's an error
    return {
      questions: sampleQuestions,
      currentQuestionIndex: 0,
      score: 100,
      maxScore: 100
    };
  }
}