import { Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server';
// import { searchTenorGifs } from './tenorApi.server'; // Disabled for now to avoid timeouts
import { CategoryType } from '../pages/CategoryPage';

const categories: CategoryType[] = ['Viral Vibes', 'Cinematic Feels', 'Gaming Moments', 'Story Experiences'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];

export async function preWarmCache(context: Context): Promise<void> {
  const startTime = Date.now();
  let recommendationsWarmed = 0;
  let synonymsWarmed = 0;
  let gifsWarmed = 0;

  // Step 1: Pre-warm all recommendation sets (8 total: 4 categories × 2 types)
  // Use Promise.allSettled to run in parallel and avoid timeout issues
  const recommendationPromises = categories.flatMap(category =>
    inputTypes.map(async inputType => {
      const recsResult = await fetchGeminiRecommendations(context, category, inputType, 20);
      if (recsResult.success && recsResult.recommendations) {
        recommendationsWarmed++;
        
        const synonymCount = inputType === 'phrase' ? 10 : 5;
        const topWords = recsResult.recommendations.slice(0, synonymCount);
        
        // Run synonym fetches in parallel within each category
        const synonymPromises = topWords.map(word => 
          fetchGeminiSynonyms(context, word).then(synResult => {
            if (synResult.success && synResult.synonyms) {
              synonymsWarmed++;
            }
          })
        );
        
        await Promise.allSettled(synonymPromises);
      }
    })
  );

  await Promise.allSettled(recommendationPromises);
  
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

