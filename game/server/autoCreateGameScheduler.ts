import { Devvit, ScheduledJobEvent, JobContext, Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server.js';
import { searchTenorGifs } from './tenorApi.server.js';
import { saveGame } from './gameHandler.server.js';
import type { CategoryType } from '../shared.js';

const categories: CategoryType[] = ['Movies', 'Gaming', 'Books', 'General'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

Devvit.addSchedulerJob({
  name: 'auto_create_post',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context; // ✅ force cast

    console.log('⏱️ Running auto_create_post...');

    const category = pickRandom(categories);
    const inputType = pickRandom(inputTypes);

    const recResult = await fetchGeminiRecommendations(context, category, inputType, 10);
    if (!recResult.success || !recResult.recommendations?.length) {
      console.error('❌ Gemini recommendations failed:', recResult.error);
      return;
    }

    const word = recResult.recommendations[0];
    const synResult = await fetchGeminiSynonyms(context, word);
    if (!synResult.success || !synResult.synonyms?.length) {
      console.error('❌ Gemini synonyms failed:', synResult.error);
      return;
    }

    const gifUrls: string[] = [];
    for (const synonymGroup of synResult.synonyms.slice(0, 4)) {
      const term = synonymGroup[0];
      const gifs = await searchTenorGifs(context, term, 1);
      const gifUrl = gifs[0]?.media_formats?.tinygif?.url;
      if (gifUrl) gifUrls.push(gifUrl);
    }

    if (gifUrls.length !== 4) {
      console.error('❌ Not enough GIFs found:', gifUrls);
      return;
    }

    const maskedWord = word
      .split('')
      .map((c) => (Math.random() < 0.66 && c !== ' ' ? '_' : c))
      .join('');

    const questionText =
      inputType === 'phrase'
        ? 'Can you guess the phrase from these GIF clues?'
        : 'Can you guess the word from these GIF clues?';

    const saveResult = await saveGame(
      {
        word,
        maskedWord,
        category,
        questionText,
        gifs: gifUrls,
        postToSubreddit: true,
      },
      context
    );

    if (saveResult.success) {
      console.log(`✅ Game created and posted with ID: ${saveResult.gameId}`);
    } else {
      console.error('❌ Failed to save game:', saveResult.error);
    }
  },
});