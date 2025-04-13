import { Devvit, ScheduledJobEvent, JobContext, Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server.js';
import { searchTenorGifs } from './tenorApi.server.js';
import { removeSystemUsersFromLeaderboard, saveGame } from './gameHandler.server.js';
import type { CategoryType } from '../shared.js';

const categories: CategoryType[] = ['Movies', 'Gaming', 'Books', 'General'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

Devvit.addSchedulerJob({
  name: 'auto_create_post',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;

    const category = pickRandom(categories);
    const inputType = pickRandom(inputTypes);

    const recResult = await fetchGeminiRecommendations(context, category, inputType, 10);
    if (!recResult.success || !recResult.recommendations?.length) {
      return;
    }

    const word = recResult.recommendations[0];
    const synResult = await fetchGeminiSynonyms(context, word);
    if (!synResult.success || !synResult.synonyms?.length) {
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

    await saveGame(
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
  },
});

Devvit.addSchedulerJob({
  name: 'clean_leaderboards',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;
    console.log('⏱️ Running leaderboard cleanup...');
    
    await removeSystemUsersFromLeaderboard(context);
  },
});