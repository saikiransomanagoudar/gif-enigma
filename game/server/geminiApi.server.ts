import type { Context } from '@devvit/web/server';
import { redis } from '@devvit/web/server';
import { getRecommendations, getSynonyms } from './geminiService';
import { CategoryType } from '../pages/CategoryPage';

const RECS_CACHE_PREFIX = 'gemini:recs:';
const SYN_CACHE_PREFIX = 'gemini:syn:';
const CACHE_TTL = 60 * 60; // Keep the 1-hour cache time

// Function to shuffle array (Fisher-Yates algorithm)
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
  console.log('[fetchGeminiRecommendations] Called with:', { category, inputType, count, excludeWords: excludeWords.length });
  
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}:day${dayOfWeek}`.toLowerCase();

  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData) as string[];
    console.log('[fetchGeminiRecommendations] Returning from cache:', parsed.length, 'items');

    const shuffledResults = shuffleArray(parsed);

    return {
      success: true,
      recommendations: shuffledResults.slice(0, count),
      debug: { source: 'cache', cacheKey, originalCount: parsed.length }
    };
  }

  console.log('[fetchGeminiRecommendations] No cache, calling Gemini API...');
  const requestCount = Math.min(50, count * 2);
  const result = await getRecommendations({ 
    category, 
    inputType, 
    count: requestCount,
    excludeWords 
  }, _context);
  console.log('[fetchGeminiRecommendations] Gemini API result:', { success: result.success, count: result.recommendations?.length, error: result.error });
  

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

// Bulk fetch all cached recommendations for instant loading
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
  
  // Fetch all words' synonyms in parallel
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
  console.log('[fetchGeminiSynonyms] Called for word:', word);
  
  // Add variety to cache key with a daily rotation
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${SYN_CACHE_PREFIX}${word}:day${dayOfWeek}`.toLowerCase();

  // 1) Check the cache
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData) as string[][];
    console.log('[fetchGeminiSynonyms] Returning from cache:', parsed.length, 'groups');
    
    return {
      success: true,
      synonyms: parsed,
      debug: { source: 'cache', cacheKey }
    };
  }

  // 2) Not cached, call the Gemini service
  console.log('[fetchGeminiSynonyms] No cache, calling Gemini API...');
  const result = await getSynonyms({ word }, context);
  console.log('[fetchGeminiSynonyms] Gemini API result:', { 
    success: result.success, 
    groupCount: result.synonyms?.length, 
    error: result.error,
    synonymsPresent: !!result.synonyms,
    synonymsType: Array.isArray(result.synonyms) ? 'array' : typeof result.synonyms,
    firstGroup: result.synonyms?.[0],
    fullResult: result
  });

  // 3) Cache if successful
  if (result.success && result.synonyms) {
    await redis.set(cacheKey, JSON.stringify(result.synonyms));
    await redis.expire(cacheKey, CACHE_TTL);
    
    // Don't shuffle synonyms as they're structured from abstract to specific
    return {
      success: true,
      synonyms: result.synonyms,
      debug: { source: 'api' }
    };
  } 
  // 4) Return final response
  return {
    success: result.success,
    synonyms: result.synonyms ?? [],
    error: result.error,
    debug: result.debug || {}
  };
}