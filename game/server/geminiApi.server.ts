import type { Context } from '@devvit/web/server';
import { redis } from '@devvit/web/server';
import { getRecommendations, getSynonyms } from './geminiService';
import { CategoryType } from '../pages/CategoryPage';

const RECS_CACHE_PREFIX = 'gemini:recs:';
const SYN_CACHE_PREFIX = 'gemini:syn:';
const CACHE_TTL = 60 * 60;

// Fisher-Yates algorithm to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export async function fetchGeminiRecommendations(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count = 20,
  excludeWords: string[] = []
): Promise<{ success: boolean; recommendations: string[]; error?: string; debug?: any }> {
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}:day${dayOfWeek}`.toLowerCase();

  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData) as string[];

    const shuffledResults = shuffleArray(parsed);

    return {
      success: true,
      recommendations: shuffledResults.slice(0, count),
      debug: { source: 'cache', cacheKey, originalCount: parsed.length }
    };
  }

  const requestCount = Math.min(50, count * 2);
  const result = await getRecommendations({ 
    category, 
    inputType, 
    count: requestCount,
    excludeWords 
  }, _context);

  if (result.success && result.recommendations) {
    await redis.set(cacheKey, JSON.stringify(result.recommendations));
    await redis.expire(cacheKey, CACHE_TTL);
    
    // Shuffle and return a subset of results for diversity
    const shuffledResults = shuffleArray(result.recommendations);
    return {
      success: true,
      recommendations: shuffledResults.slice(0, count),
      debug: {
        source: 'api',
        originalCount: result.recommendations.length,
        returnedCount: count
      }
    };
  }

  return {
    success: result.success,
    recommendations: result.recommendations ? shuffleArray(result.recommendations).slice(0, count) : [],
    error: result.error,
    debug: result.debug || {}
  };
}

// Bulk fetch all cached recommendations
export async function bulkFetchCachedRecommendations(
  _context: Context
): Promise<{ [key: string]: string[] }> {
  const categories: CategoryType[] = ['Viral Vibes', 'Cinematic Feels', 'Gaming Moments', 'Story Experiences'];
  const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
  const dayOfWeek = new Date().getDay();
  const count = 20;
  
  const result: { [key: string]: string[] } = {};
  
  // Fetch all 8 combinations in parallel
  const promises = categories.flatMap(category =>
    inputTypes.map(async inputType => {
      const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}:day${dayOfWeek}`.toLowerCase();
      const frontendKey = `${category}-${inputType}`;
      
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData) as string[];
        const shuffledResults = shuffleArray(parsed);
        result[frontendKey] = shuffledResults.slice(0, count);
      }
    })
  );
  
  await Promise.allSettled(promises);
  return result;
}

// Bulk fetch cached synonyms for multiple words
export async function bulkFetchCachedSynonyms(
  _context: Context,
  words: string[]
): Promise<{ [word: string]: string[][] }> {
  const dayOfWeek = new Date().getDay();
  const result: { [word: string]: string[][] } = {};
  
  const promises = words.map(async word => {
    const cacheKey = `${SYN_CACHE_PREFIX}${word}:day${dayOfWeek}`.toLowerCase();
    
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData) as string[][];
      result[word] = parsed;
    }
  });
  
  await Promise.allSettled(promises);
  return result;
}

export async function fetchGeminiSynonyms(
  context: Context,
  word: string
): Promise<{ success: boolean; synonyms: string[][]; error?: string; debug?: any }> {
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${SYN_CACHE_PREFIX}${word}:day${dayOfWeek}`.toLowerCase();

  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData) as string[][];  
    return {
      success: true,
      synonyms: parsed,
      debug: { source: 'cache', cacheKey }
    };
  }

  const result = await getSynonyms({ word }, context);

  if (result.success && result.synonyms) {
    await redis.set(cacheKey, JSON.stringify(result.synonyms));
    await redis.expire(cacheKey, CACHE_TTL);
    return {
      success: true,
      synonyms: result.synonyms,
      debug: { source: 'api' }
    };
  }
  
  return {
    success: result.success,
    synonyms: result.synonyms ?? [],
    error: result.error,
    debug: result.debug || {}
  };
}