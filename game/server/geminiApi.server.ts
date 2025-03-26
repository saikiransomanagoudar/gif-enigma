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
  count = 20
): Promise<{ success: boolean; recommendations: string[]; error?: string; debug?: any }> {
  console.log(`[SERVER] Fetching recommendations for category: ${category}, type: ${inputType}, count: ${count}`);
  
  const cacheKey = `${RECS_CACHE_PREFIX}${category}:${inputType}:${count}`.toLowerCase();

  try {
    console.log(`[SERVER] Checking Redis cache with key: ${cacheKey}`);
    const cachedData = await context.redis.get(cacheKey);
    if (cachedData) {
      console.log('[SERVER] Cache hit! Returning cached recommendations');
      try {
        const parsed = JSON.parse(cachedData);
        return {
          success: true,
          recommendations: parsed,
          debug: { source: 'cache', cacheKey }
        };
      } catch (parseError) {
        console.error('[SERVER] Error parsing cached data:', parseError);
        // Continue if cache parsing fails
      }
    } else {
      console.log('[SERVER] Cache miss, will call Gemini service');
    }
  } catch (error) {
    console.error('[SERVER] Error reading from Redis cache:', error);
  }

  console.log('[SERVER] Making Gemini API call for recommendations');
  const result = await getRecommendations({ category, inputType, count }, context);
  console.log(`[SERVER] Gemini API response: success=${result.success}, recommendations count=${result.recommendations?.length}`);

  if (result.success && result.recommendations) {
    try {
      console.log('[SERVER] Caching successful response to Redis');
      await context.redis.set(cacheKey, JSON.stringify(result.recommendations));
      await context.redis.expire(cacheKey, CACHE_TTL);
      console.log('[SERVER] Successfully cached recommendations');
    } catch (error) {
      console.error('[SERVER] Error writing to Redis cache:', error);
    }
  } else {
    console.log(`[SERVER] Not caching result due to error: ${result.error}`);
  }

  return {
    success: result.success,
    recommendations: result.recommendations ?? [],
    error: result.error,
    debug: result.debug || {}
  };
}

export async function fetchGeminiSynonyms(
  context: Context,
  word: string
): Promise<{ success: boolean; synonyms: string[][]; error?: string; debug?: any }> {
  console.log(`[SERVER] Fetching synonyms for word: ${word}`);
  
  const cacheKey = `${SYN_CACHE_PREFIX}${word}`.toLowerCase();

  // 1) Check the cache
  try {
    console.log(`[SERVER] Checking Redis cache for synonyms with key: ${cacheKey}`);
    const cachedData = await context.redis.get(cacheKey);
    if (cachedData) {
      console.log('[SERVER] Cache hit for synonyms!');
      try {
        const parsed = JSON.parse(cachedData);
        return {
          success: true,
          synonyms: parsed,
          debug: { source: 'cache', cacheKey }
        };
      } catch (parseError) {
        console.error('[SERVER] Error parsing cached synonyms data:', parseError);
        // Continue if cache parsing fails
      }
    } else {
      console.log('[SERVER] Cache miss for synonyms, will call Gemini service');
    }
  } catch (error) {
    console.error('[SERVER] Error reading synonyms from Redis cache:', error);
  }

  // 2) Not cached, call the Gemini service
  console.log('[SERVER] Making Gemini API call for synonyms');
  const result = await getSynonyms({ word }, context);
  console.log(`[SERVER] Gemini API synonyms response: success=${result.success}, synonym sets=${result.synonyms?.length}`);

  // 3) Cache if successful
  if (result.success && result.synonyms) {
    try {
      console.log('[SERVER] Caching successful synonyms response to Redis');
      await context.redis.set(cacheKey, JSON.stringify(result.synonyms));
      await context.redis.expire(cacheKey, CACHE_TTL);
      console.log('[SERVER] Successfully cached synonyms');
    } catch (error) {
      console.error('[SERVER] Error writing synonyms to Redis cache:', error);
    }
  } else {
    console.log(`[SERVER] Not caching synonyms result due to error: ${result.error}`);
  }

  // 4) Return final response
  return {
    success: result.success,
    synonyms: result.synonyms ?? [],
    error: result.error,
    debug: result.debug || {}
  };
}

// This is a test function that can be called directly to check if the Gemini API is working
export async function testGeminiConnection(
  context: Context
): Promise<{ success: boolean; message: string; error?: string }> {
  console.log('[SERVER] Testing Gemini API connection');
  
  try {
    // Check if API key exists
    const apiKey = await context.settings.get('gemini-api-key');
    
    if (!apiKey) {
      console.error('[SERVER] Gemini API key not found in settings');
      return {
        success: false,
        message: 'API key not configured in Devvit settings',
        error: 'Missing API key'
      };
    }
    
    console.log('[SERVER] API key found, testing basic API call');
    
    // Make a simple API call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Respond with the word "success" as a JSON string.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20,
            topP: 0.95,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SERVER] Gemini API test failed with status ${response.status}: ${errorText}`);
      return {
        success: false,
        message: `API connection test failed with status: ${response.status}`,
        error: errorText.substring(0, 200)
      };
    }
    
    const data = await response.json();
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('[SERVER] Gemini API test successful!');
      return {
        success: true,
        message: 'Successfully connected to Gemini API',
      };
    } else {
      console.error('[SERVER] Unexpected response format from Gemini API test');
      return {
        success: false,
        message: 'API responded but with unexpected format',
        error: JSON.stringify(data)
      };
    }
  } catch (error) {
    console.error('[SERVER] Error testing Gemini API connection:', error);
    return {
      success: false,
      message: 'Error connecting to Gemini API',
      error: String(error)
    };
  }
}