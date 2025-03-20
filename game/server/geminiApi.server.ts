import { Context } from '@devvit/public-api';
import { getRecommendations, getSynonyms } from './geminiService';
import { CategoryType } from '../pages/CategoryPage';

const RECS_CACHE_PREFIX = 'gemini:recs:';
const SYN_CACHE_PREFIX = 'gemini:syn:';
const CACHE_TTL = 60 * 60;

export async function fetchGeminiRecommendations(
  context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count = 10
): Promise<{ success: boolean; recommendations: string[]; error?: string }> {
  const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}`.toLowerCase();

  try {
    const cachedData = await context.redis.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return {
        success: true,
        recommendations: parsed,
      };
    }
  } catch (error) {
    console.error('Error reading from Redis cache:', error);
  }

  const result = await getRecommendations({ category, inputType, count }, context);

  if (result.success && result.recommendations) {
    try {
      await context.redis.set(cacheKey, JSON.stringify(result.recommendations));
      await context.redis.expire(cacheKey, CACHE_TTL);
    } catch (error) {
      console.error('Error writing to Redis cache:', error);
    }
  }

  return {
    success: result.success,
    recommendations: result.recommendations ?? [],
    error: result.error,
  };
}

export async function fetchGeminiSynonyms(
  context: Context,
  word: string
): Promise<{ success: boolean; synonyms: string[][]; error?: string }> {
  const cacheKey = `${SYN_CACHE_PREFIX}${word}`.toLowerCase();

  // 1) Check the cache
  try {
    const cachedData = await context.redis.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return {
        success: true,
        synonyms: parsed,
      };
    }
  } catch (error) {
    console.error('Error reading from Redis cache:', error);
  }

  // 2) Not cached, call the Gemini service
  const result = await getSynonyms({ word }, context);

  // 3) Cache if successful
  if (result.success && result.synonyms) {
    try {
      await context.redis.set(cacheKey, JSON.stringify(result.synonyms));
      await context.redis.expire(cacheKey, CACHE_TTL);
    } catch (error) {
      console.error('Error writing to Redis cache:', error);
    }
  }

  // 4) Return final response
  return {
    success: result.success,
    synonyms: result.synonyms ?? [],
    error: result.error,
  };
}
