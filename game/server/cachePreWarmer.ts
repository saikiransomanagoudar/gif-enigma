import { Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server';
// import { searchTenorGifs } from './tenorApi.server'; // Disabled for now to avoid timeouts
import { CategoryType } from '../pages/CategoryPage';

const categories: CategoryType[] = ['General', 'Movies', 'Gaming', 'Books'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];

/**
 * Pre-warm cache by generating and caching all recommendation sets and their synonyms
 * This runs daily to ensure fast first-load experience for all users
 */
export async function preWarmCache(context: Context): Promise<void> {

  const startTime = Date.now();
  let recommendationsWarmed = 0;
  let synonymsWarmed = 0;
  let gifsWarmed = 0;

  // Step 1: Pre-warm all recommendation sets (8 total: 4 categories × 2 types)
  for (const category of categories) {
    for (const inputType of inputTypes) {
      // Fetch recommendations (will cache automatically)
      const recsResult = await fetchGeminiRecommendations(context, category, inputType, 20);
        
      if (recsResult.success && recsResult.recommendations) {
        recommendationsWarmed++;
        
        // Step 2: Pre-warm synonyms for top 5 words/phrases from each set
        const topWords = recsResult.recommendations.slice(0, 5);
        
        for (const word of topWords) {
          // Fetch synonyms (will cache automatically)
          const synResult = await fetchGeminiSynonyms(context, word);
            
          if (synResult.success && synResult.synonyms) {
            synonymsWarmed++;
          }
          
          // Longer delay to avoid authentication timeouts
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Longer delay between category/type combinations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Store completion status in Redis
  await context.redis.set('cache:prewarmer:last_run', new Date().toISOString());
  await context.redis.set('cache:prewarmer:stats', JSON.stringify({
    recommendations: recommendationsWarmed,
    synonyms: synonymsWarmed,
    gifs: gifsWarmed,
    duration,
    timestamp: Date.now()
  }));
}

