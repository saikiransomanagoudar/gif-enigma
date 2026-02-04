import { Context } from '@devvit/public-api';
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
  context: Context,
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
    const historyData = await context.redis.get(historyKey);
    
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
  context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  words: string[]
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const historyKey = `pregenerated:history:${category}:${inputType}:${today}`;
  
  await context.redis.set(
    historyKey,
    JSON.stringify(words),
    { expiration: new Date(Date.now() + HISTORY_DAYS * 24 * 60 * 60 * 1000) } // Auto-delete after 7 days
  );
}

/**
 * Check if pre-generation has already run in the last 23 hours
 */
export async function hasRecentlyRun(context: Context): Promise<boolean> {
  try {
    const lastRunStr = await context.redis.get('pregenerated:last_run');
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
  // Check if we've already run recently (unless forced)
  if (!force) {
    const recentlyRun = await hasRecentlyRun(context);
    if (recentlyRun) {
      return;
    }
  }
  
  const startTime = Date.now();
  
  let totalGenerated = 0;
  const ITEMS_PER_CATEGORY_TYPE = 30; // Generate 30 items per category/type combination
  
  // Process each category/type combination
  for (const category of categories) {
    for (const inputType of inputTypes) {
      // Get words from last 7 days to avoid duplicates
      const excludeWords = await getRecentHistory(context, category, inputType);
      
      // Fetch MORE recommendations than we'll show (30 items) with exclusion list
      const recsResult = await fetchGeminiRecommendations(context, category, inputType, ITEMS_PER_CATEGORY_TYPE, excludeWords);
      
      if (recsResult.success && recsResult.recommendations) {
        const words = recsResult.recommendations;
        let successCount = 0;
        
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
                  await context.redis.set(itemKey, JSON.stringify(item), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) }); // 24 hour TTL
                  
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
        
        totalGenerated += successCount;
        
        // Store metadata about how many items exist for this combination
        const metaKey = `pregenerated:meta:${category}:${inputType}`;
        await context.redis.set(metaKey, successCount.toString(), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        
        // Store history for future exclusion (only successful words)
        const generatedWords = words.slice(0, successCount);
        await storeHistory(context, category, inputType, generatedWords);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Store completion stats
  await context.redis.set('pregenerated:last_run', new Date().toISOString(), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  await context.redis.set('pregenerated:stats', JSON.stringify({
    totalGenerated,
    duration,
    timestamp: Date.now(),
    categories: categories.length,
    inputTypes: inputTypes.length
  }), { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) });
}

/**
 * Fetch a random pre-generated word/phrase with synonyms
 * This runs instantly with ZERO API calls
 */
export async function fetchRandomPreGenerated(
  context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase'
): Promise<{ success: boolean; item?: PreGeneratedItem }> {
  try {
    // Get count of available items
    const metaKey = `pregenerated:meta:${category}:${inputType}`;
    const countStr = await context.redis.get(metaKey);
    
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
    
    const itemStr = await context.redis.get(itemKey);
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
  context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count: number = 20
): Promise<{ success: boolean; items?: PreGeneratedItem[] }> {
  try {
    const metaKey = `pregenerated:meta:${category}:${inputType}`;
    const countStr = await context.redis.get(metaKey);
    
    if (!countStr) {
      return { success: false };
    }
    
    const availableCount = parseInt(countStr);
    if (availableCount === 0) {
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
      const itemStr = await context.redis.get(itemKey);
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
