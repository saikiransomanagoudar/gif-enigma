import { Context } from '@devvit/public-api';
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
  context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count = 20
): Promise<{ success: boolean; recommendations: string[]; error?: string; debug?: any }> {
  
  // Add randomization factor to cache keys to maintain multiple result sets
  // We'll use day of week (0-6) to rotate through different cache sets
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}:day${dayOfWeek}`.toLowerCase();

  const cachedData = await context.redis.get(cacheKey);
  if (cachedData) {
    // Add proper type assertion for the parsed data
    const parsed = JSON.parse(cachedData) as string[];
    
    // Even for cached results, shuffle them for diversity
    // and take slightly more items than requested to ensure variety
    const shuffledResults = shuffleArray(parsed);
    
    // Return shuffled subset of our cached results
    return {
      success: true,
      recommendations: shuffledResults.slice(0, count),
      debug: { source: 'cache', cacheKey, originalCount: parsed.length }
    };
  }
  
  // Request more than we need so we can shuffle and have variety
  const requestCount = Math.min(50, count * 2);
  const result = await getRecommendations({ category, inputType, count: requestCount }, context);
  

  if (result.success && result.recommendations) {
    await context.redis.set(cacheKey, JSON.stringify(result.recommendations));
    await context.redis.expire(cacheKey, CACHE_TTL);
    
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

export async function fetchGeminiSynonyms(
  context: Context,
  word: string
): Promise<{ success: boolean; synonyms: string[][]; error?: string; debug?: any }> {
  
  // Add variety to cache key with a daily rotation
  const dayOfWeek = new Date().getDay();
  const cacheKey = `${SYN_CACHE_PREFIX}${word}:day${dayOfWeek}`.toLowerCase();

  // 1) Check the cache
  const cachedData = await context.redis.get(cacheKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData) as string[][];
    
    // We don't shuffle synonym groups since they're structured as progressive hints
    // (from abstract to specific)
    return {
      success: true,
      synonyms: parsed,
      debug: { source: 'cache', cacheKey }
    };
  }

  // 2) Not cached, call the Gemini service
  const result = await getSynonyms({ word }, context);

  // 3) Cache if successful
  if (result.success && result.synonyms) {
    await context.redis.set(cacheKey, JSON.stringify(result.synonyms));
    await context.redis.expire(cacheKey, CACHE_TTL);
    
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