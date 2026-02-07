import type { Context } from '@devvit/web/server';
import { redis } from '@devvit/web/server';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server.js';
import type { CategoryType } from '../shared.js';

const categories: CategoryType[] = ['Viral Vibes', 'Cinematic Feels', 'Gaming Moments', 'Story Experiences'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
const HISTORY_DAYS = 7; // Track last 7 days to avoid duplicates

interface PreGeneratedItem {
  word: string;
  synonyms: string[][];
  category: CategoryType;
  inputType: 'word' | 'phrase';
  generatedAt: number;
}

/**
 * Get words/phrases generated in the last N days for a category/type
 */
async function getRecentHistory(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase'
): Promise<string[]> {
  const history: string[] = [];
  const today = new Date();
  
  // Check last 7 days
  for (let daysAgo = 1; daysAgo <= HISTORY_DAYS; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const historyKey = `pregenerated:history:${category}:${inputType}:${dateKey}`;
    const historyData = await redis.get(historyKey);
    
    if (historyData) {
      const words = JSON.parse(historyData) as string[];
      history.push(...words);
    }
  }
  
  return history;
}

/**
 * Store today's generated words for future exclusion
 */
async function storeHistory(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  words: string[]
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const historyKey = `pregenerated:history:${category}:${inputType}:${today}`;
  
  await redis.set(
    historyKey,
    JSON.stringify(words),
    { expiration: new Date(Date.now() + HISTORY_DAYS * 24 * 60 * 60 * 1000) } // Auto-delete after 7 days
  );
}

/**
 * Check if pre-generation has already run in the last 23 hours
 */
export async function hasRecentlyRun(_context: Context): Promise<boolean> {
  try {
    const lastRunStr = await redis.get('pregenerated:last_run');
    if (!lastRunStr) return false;
    
    const lastRun = new Date(lastRunStr).getTime();
    const now = Date.now();
    const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
    
    return hoursSinceLastRun < 23; // Run only if it's been 23+ hours
  } catch (error) {
    return false;
  }
}

/**
 * Main pre-generation function that creates a large pool of words/phrases with synonyms
 * This eliminates ALL API calls during user interaction
 * Called by the cache_prewarmer scheduler job
 */

export async function preGenerateItems(context: Context, force: boolean = false): Promise<void> {
  try {
    console.log('[DEVVIT] [preGenerateItems] Starting pre-generation, force:', force);
    console.log('[DEVVIT] [preGenerateItems] Context check:', { hasRedis: !!redis, hasContext: !!context });
    
    // Check if we've already run recently (unless forced)
    if (!force) {
      const recentlyRun = await hasRecentlyRun(context);
      console.log('[DEVVIT] [preGenerateItems] Recently run check:', recentlyRun);
      if (recentlyRun) {
        console.log('[DEVVIT] [preGenerateItems] Skipping - already ran recently');
        return;
      }
    }
    
    const startTime = Date.now();
    
    let totalGenerated = 0;
    const ITEMS_PER_CATEGORY_TYPE = 30; // Generate 30 items per category/type combination (120 words + 120 phrases daily)
    
    console.log('[DEVVIT] [preGenerateItems] Will generate', ITEMS_PER_CATEGORY_TYPE, 'items per category/type');
    
    // Process each category/type combination
    for (const category of categories) {
      for (const inputType of inputTypes) {
        console.log('[DEVVIT] [preGenerateItems] Processing:', category, inputType);
        
        // Get words from last 7 days to avoid duplicates
        const excludeWords = await getRecentHistory(context, category, inputType);
        console.log('[DEVVIT] [preGenerateItems] Excluding', excludeWords.length, 'recent words');
        
        // Fetch MORE recommendations than we'll show (30 items) with exclusion list
        console.log('[DEVVIT] [preGenerateItems] Fetching recommendations from Gemini...');
        const recsResult = await fetchGeminiRecommendations(context, category, inputType, ITEMS_PER_CATEGORY_TYPE, excludeWords);
        console.log('[DEVVIT] [preGenerateItems] Recommendations result:', recsResult.success, 'count:', recsResult.recommendations?.length);
      
      if (recsResult.success && recsResult.recommendations) {
        const words = recsResult.recommendations;
        let successCount = 0;
        
        console.log('[DEVVIT] [preGenerateItems] Fetching synonyms for', words.length, 'words...');
        
        // Generate synonyms for all words in parallel
        await Promise.allSettled(
          words.map(async (word, idx) => {
            // Try up to 2 times for each word
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const synResult = await fetchGeminiSynonyms(context, word);
                
                if (synResult.success && synResult.synonyms) {
                  const item: PreGeneratedItem = {
                    word,
                    synonyms: synResult.synonyms,
                    category,
                    inputType,
                    generatedAt: Date.now()
                  };
                  
                  // Store each item with index specific to this category/type
                  const itemKey = `pregenerated:${category}:${inputType}:${idx}`;
                  await redis.set(itemKey, JSON.stringify(item), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) }); // 24 hour TTL
                  
                  successCount++;
                  return { success: true, word };
                }
                
                // If first attempt failed, wait before retry
                if (attempt === 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (error) {
                if (attempt === 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
            return { success: false, word };
          })
        );
        
        console.log('[DEVVIT] [preGenerateItems] Successfully generated', successCount, 'items for', category, inputType);
        totalGenerated += successCount;
        
        // Store metadata about how many items exist for this combination
        const metaKey = `pregenerated:meta:${category}:${inputType}`;
        await redis.set(metaKey, successCount.toString(), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        console.log('[DEVVIT] [preGenerateItems] Stored meta key:', metaKey, '=', successCount);
        
        // Store history for future exclusion (only successful words)
        const generatedWords = words.slice(0, successCount);
        await storeHistory(context, category, inputType, generatedWords);
      } else {
        console.log('[DEVVIT] [preGenerateItems] Failed to get recommendations for', category, inputType);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log('[DEVVIT] [preGenerateItems] Completed! Total generated:', totalGenerated, 'Duration:', duration, 'ms');
  
  // Store completion stats
  await redis.set('pregenerated:last_run', new Date().toISOString(), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  await redis.set('pregenerated:stats', JSON.stringify({
    totalGenerated,
    duration,
    timestamp: Date.now(),
    categories: categories.length,
    inputTypes: inputTypes.length
  }), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  
  console.log('[DEVVIT] [preGenerateItems] Stats stored in Redis');
  } catch (error) {
    console.error('[DEVVIT] [preGenerateItems] FATAL ERROR:', error);
    if (error instanceof Error) {
      console.error('[DEVVIT] [preGenerateItems] Error message:', error.message);
      console.error('[DEVVIT] [preGenerateItems] Stack trace:', error.stack);
    }
    throw error; // Re-throw so the caller can handle it
  }
}

/**
 * Fetch a random pre-generated word/phrase with synonyms
 * This runs instantly with ZERO API calls
 */
export async function fetchRandomPreGenerated(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase'
): Promise<{ success: boolean; item?: PreGeneratedItem }> {
  try {
    // Get count of available items
    const metaKey = `pregenerated:meta:${category}:${inputType}`;
    const countStr = await redis.get(metaKey);
    
    if (!countStr) {
      return { success: false };
    }
    
    const count = parseInt(countStr);
    if (count === 0) {
      return { success: false };
    }
    
    // Pick a random index
    const randomIndex = Math.floor(Math.random() * count);
    const itemKey = `pregenerated:${category}:${inputType}:${randomIndex}`;
    
    const itemStr = await redis.get(itemKey);
    if (!itemStr) {
      return { success: false };
    }
    
    const item: PreGeneratedItem = JSON.parse(itemStr);
    
    return { success: true, item };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Fetch multiple random pre-generated items (for variety)
 * Returns array of unique items
 */
export async function fetchMultiplePreGenerated(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count: number = 20
): Promise<{ success: boolean; items?: PreGeneratedItem[] }> {
  try {
    const metaKey = `pregenerated:meta:${category}:${inputType}`;
    console.log('[fetchMultiplePreGenerated] Looking for metaKey:', metaKey);
    const countStr = await redis.get(metaKey);
    console.log('[fetchMultiplePreGenerated] countStr:', countStr);
    
    if (!countStr) {
      console.log('[fetchMultiplePreGenerated] No meta key found, returning false');
      return { success: false };
    }
    
    const availableCount = parseInt(countStr);
    console.log('[fetchMultiplePreGenerated] availableCount:', availableCount);
    if (availableCount === 0) {
      console.log('[fetchMultiplePreGenerated] availableCount is 0, returning false');
      return { success: false };
    }
    
    // Generate random unique indices
    const requestCount = Math.min(count, availableCount);
    const indices = new Set<number>();
    while (indices.size < requestCount) {
      indices.add(Math.floor(Math.random() * availableCount));
    }
    
    // Fetch all items in parallel
    const itemPromises = Array.from(indices).map(async (index) => {
      const itemKey = `pregenerated:${category}:${inputType}:${index}`;
      const itemStr = await redis.get(itemKey);
      if (itemStr) {
        return JSON.parse(itemStr) as PreGeneratedItem;
      }
      return null;
    });
    
    const items = (await Promise.all(itemPromises)).filter((item): item is PreGeneratedItem => item !== null);
    
    return { success: true, items };
  } catch (error) {
    return { success: false };
  }
}
