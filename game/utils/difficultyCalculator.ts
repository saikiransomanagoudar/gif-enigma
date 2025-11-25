// utils/difficultyCalculator.ts
import { DifficultyLevel } from '../lib/types';

export function calculateDifficulty(word: string): DifficultyLevel {
  const cleanWord = word.replace(/\s+/g, '').toUpperCase();
  const wordLength = cleanWord.length;
  const isPhrase = word.includes(' ');

  let difficultyScore = 0;

  if (wordLength <= 6) {
    difficultyScore += 1; // Very short
  } else if (wordLength <= 8) {
    difficultyScore += 2; // Short
  } else if (wordLength <= 11) {
    difficultyScore += 3; // Medium
  } else if (wordLength <= 14) {
    difficultyScore += 4; // Long
  } else {
    difficultyScore += 5; // Very long
  }
  
  // Phrase bonus (phrases are generally easier due to context)
  if (isPhrase) {
    const wordCount = word.split(' ').length;
    if (wordCount >= 3) {
      difficultyScore -= 1; // Multi-word phrases easier
    }
  }
  
  // Word complexity heuristics
  const hasRepeatingLetters = /(.)\1/.test(cleanWord);
  const vowelCount = (cleanWord.match(/[AEIOU]/g) || []).length;
  const vowelRatio = vowelCount / cleanWord.length;
  
  // Common patterns make it easier
  if (hasRepeatingLetters) {
    difficultyScore -= 0.5; // Patterns help
  }
  
  // Very consonant-heavy words are harder
  if (vowelRatio < 0.25) {
    difficultyScore += 1;
  }
  
  // Very vowel-heavy words are easier
  if (vowelRatio > 0.5) {
    difficultyScore -= 0.5;
  }
  
  // Common letter frequency (ETAOIN SHRDLU) - if word has many common letters, easier
  const commonLetters = 'ETAOINSHRDLU';
  const commonLetterCount = cleanWord.split('').filter(c => commonLetters.includes(c)).length;
  const commonLetterRatio = commonLetterCount / cleanWord.length;
  
  if (commonLetterRatio > 0.7) {
    difficultyScore -= 0.5; // Very common letters = easier
  } else if (commonLetterRatio < 0.4) {
    difficultyScore += 0.5; // Rare letters = harder
  }
  
  // Map score to difficulty level
  if (difficultyScore <= 2) {
    return 'Easy';
  } else if (difficultyScore <= 3.5) {
    return 'Medium';
  } else if (difficultyScore <= 5) {
    return 'Hard';
  } else {
    return 'Expert';
  }
}

export function getDifficultyEmoji(_difficulty: DifficultyLevel): string {
  return '';
}

export function getDifficultyColor(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'Easy':
      return '#22c55e'; // green-500
    case 'Medium':
      return '#eab308'; // yellow-500
    case 'Hard':
      return '#f97316'; // orange-500
    case 'Expert':
      return '#ef4444'; // red-500
    default:
      return '#eab308';
  }
}
