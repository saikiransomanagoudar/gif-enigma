import type { Context } from '@devvit/web/server';
import { redis } from '@devvit/web/server';
import { fetchGeminiRecommendations, fetchGeminiSynonymsBatch } from './geminiApi.server.js';
import { CategoryType } from '../pages/CategoryPage';

const categories: CategoryType[] = [
  'Viral Vibes',
  'Cinematic Feels',
  'Gaming Moments',
  'Story Experiences',
];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
const HISTORY_DAYS = 7;

interface PreGeneratedItem {
  word: string;
  synonyms: string[][];
  category: CategoryType;
  inputType: 'word' | 'phrase';
  generatedAt: number;
}

async function getRecentHistory(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase'
): Promise<string[]> {
  const history: string[] = [];
  const today = new Date();

  for (let daysAgo = 1; daysAgo <= HISTORY_DAYS; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dateKey = date.toISOString().split('T')[0];

    const historyKey = `pregenerated:history:${category}:${inputType}:${dateKey}`;
    const historyData = await redis.get(historyKey);

    if (historyData) {
      const words = JSON.parse(historyData) as string[];
      history.push(...words);
    }
  }

  return history;
}

async function storeHistory(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  words: string[]
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const historyKey = `pregenerated:history:${category}:${inputType}:${today}`;

  await redis.set(historyKey, JSON.stringify(words), {
    expiration: new Date(Date.now() + HISTORY_DAYS * 24 * 60 * 60 * 1000),
  });
}

export async function hasRecentlyRun(_context: Context): Promise<boolean> {
  try {
    const lastRunStr = await redis.get('pregenerated:last_run');
    if (!lastRunStr) return false;

    const lastRun = new Date(lastRunStr).getTime();
    const now = Date.now();
    const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

    return hoursSinceLastRun < 23;
  } catch (error) {
    return false;
  }
}

export async function preGenerateItems(context: Context, force: boolean = false): Promise<void> {
  try {
    if (!force) {
      const recentlyRun = await hasRecentlyRun(context);
      if (recentlyRun) {
        return;
      }
    }

    const startTime = Date.now();
    let totalGenerated = 0;
    const ITEMS_PER_CATEGORY_TYPE = 30;

    for (const category of categories) {
      for (const inputType of inputTypes) {
        const excludeWords = await getRecentHistory(context, category, inputType);
        const recsResult = await fetchGeminiRecommendations(
          context,
          category,
          inputType,
          ITEMS_PER_CATEGORY_TYPE,
          excludeWords
        );

        if (recsResult.success && recsResult.recommendations) {
          const words = recsResult.recommendations;

          // Generate synonyms for all words in one batched Gemini call
          // (instruction prompt is paid once per batch instead of once per word)
          const synonymsByWord = await fetchGeminiSynonymsBatch(context, words);

          const successfulWords: string[] = [];
          for (const word of words) {
            const synonyms = synonymsByWord[word];
            if (!synonyms || synonyms.length === 0) continue;

            const item: PreGeneratedItem = {
              word,
              synonyms,
              category,
              inputType,
              generatedAt: Date.now(),
            };
            const itemKey = `pregenerated:${category}:${inputType}:${successfulWords.length}`;
            await redis.set(itemKey, JSON.stringify(item), {
              expiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });
            successfulWords.push(word);
          }

          totalGenerated += successfulWords.length;
          const metaKey = `pregenerated:meta:${category}:${inputType}`;
          await redis.set(metaKey, successfulWords.length.toString(), {
            expiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
          await storeHistory(context, category, inputType, successfulWords);
        }
      }
    }

    const duration = Date.now() - startTime;
    await redis.set('pregenerated:last_run', new Date().toISOString(), {
      expiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await redis.set(
      'pregenerated:stats',
      JSON.stringify({
        totalGenerated,
        duration,
        timestamp: Date.now(),
        categories: categories.length,
        inputTypes: inputTypes.length,
      }),
      { expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    );
  } catch (error) {
    throw error;
  }
}

export async function fetchRandomPreGenerated(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase'
): Promise<{ success: boolean; item?: PreGeneratedItem }> {
  try {
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

export async function fetchMultiplePreGenerated(
  _context: Context,
  category: CategoryType,
  inputType: 'word' | 'phrase',
  count: number = 20
): Promise<{ success: boolean; items?: PreGeneratedItem[] }> {
  try {
    const metaKey = `pregenerated:meta:${category}:${inputType}`;
    const countStr = await redis.get(metaKey);

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
      const itemStr = await redis.get(itemKey);
      if (itemStr) {
        return JSON.parse(itemStr) as PreGeneratedItem;
      }
      return null;
    });

    const items = (await Promise.all(itemPromises)).filter(
      (item): item is PreGeneratedItem => item !== null
    );

    return { success: true, items };
  } catch (error) {
    return { success: false };
  }
}
