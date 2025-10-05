import { Devvit, ScheduledJobEvent, JobContext, Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server.js';
import { searchTenorGifs } from './tenorApi.server.js';
import { removeSystemUsersFromLeaderboard, saveGame } from './gameHandler.server.js';
import type { CategoryType } from '../shared.js';

const categories: CategoryType[] = ['Movies', 'Gaming', 'Books', 'General'];
const inputTypes: ('word' | 'phrase')[] = ['word', 'phrase'];
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Fallback data for when API is rate limited
const fallbackData = {
  'Movies': {
    word: ['STARWARS', 'TITANIC', 'AVENGERS', 'BATMAN', 'SPIDERMAN', 'FROZEN', 'TOYSTORY', 'PIRATES', 'WIZARD', 'GHOSTBUSTERS'],
    phrase: ['MAY THE FORCE BE WITH YOU', 'I AM YOUR FATHER', 'TO INFINITY AND BEYOND', 'HERE IS JOHNNY', 'I WILL BE BACK', 'SHOW ME THE MONEY', 'ELEMENTARY MY DEAR WATSON', 'LIFE IS LIKE A BOX OF CHOCOLATES', 'I AM SPARTACUS', 'HOUSTON WE HAVE A PROBLEM']
  },
  'Gaming': {
    word: ['POKEMON', 'MARIO', 'SONIC', 'ZELDA', 'FORTNITE', 'MINECRAFT', 'PACMAN', 'TETRIS', 'DONKEYKONG'],
    phrase: ['GAME OVER', 'LEVEL UP', 'NEW HIGH SCORE', 'PLAYER ONE READY', 'CONTINUE GAME', 'SAVE GAME', 'LOAD GAME', 'PAUSE GAME', 'RESUME GAME', 'QUIT GAME']
  },
  'Books': {
    word: ['HARRY', 'POTTER', 'SHERLOCK', 'HOLMES', 'DRACULA', 'FRANKENSTEIN', 'ALICE', 'WONDERLAND', 'ROBINHOOD', 'MULAN'],
    phrase: ['ONCE UPON A TIME', 'THE END', 'CHAPTER ONE', 'TO BE CONTINUED', 'THE ADVENTURE BEGINS', 'THE MYSTERY DEEPENS', 'THE FINAL CHAPTER', 'THE LEGEND LIVES ON', 'THE STORY CONTINUES', 'THE TALE IS TOLD']
  },
  'General': {
    word: ['ELEPHANT', 'BUTTERFLY', 'RAINBOW', 'MOUNTAIN', 'OCEAN', 'FOREST', 'CASTLE', 'DRAGON', 'MAGIC', 'DREAM'],
    phrase: ['ONCE UPON A TIME', 'HAPPY BIRTHDAY', 'GOOD MORNING', 'SEE YOU LATER', 'THANK YOU VERY MUCH', 'I LOVE YOU', 'HOW ARE YOU', 'WHAT TIME IS IT', 'HAVE A NICE DAY', 'GOOD NIGHT']
  }
};

const fallbackSynonyms = {
  'STARWARS': [['space', 'lightsaber', 'force', 'jedi'], ['galaxy', 'darth', 'vader', 'rebel'], ['yoda', 'luke', 'princess', 'leia'], ['death', 'star', 'empire', 'hope']],
  'POKEMON': [['pikachu', 'catch', 'trainer', 'battle'], ['ash', 'gym', 'evolution', 'pokeball'], ['gotta', 'catch', 'em', 'all'], ['monster', 'creature', 'adventure', 'friend']],
  'HARRY': [['potter', 'wizard', 'hogwarts', 'magic'], ['spell', 'wand', 'voldemort', 'hermione'], ['ron', 'weasley', 'quidditch', 'dumbledore'], ['gryffindor', 'invisibility', 'cloak', 'phoenix']],
  'ELEPHANT': [['animal', 'large', 'trunk', 'gray'], ['mammal', 'big', 'ivory', 'herd'], ['creature', 'huge', 'tusk', 'safari'], ['beast', 'massive', 'memory', 'zoo']]
};

Devvit.addSchedulerJob({
  name: 'auto_create_post',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;

    const category = pickRandom(categories);
    const inputType = pickRandom(inputTypes);

    console.log(`🤖 Auto-scheduler: Creating game for ${category} ${inputType}`);

    let recommendations: string[] = [];
    let synonyms: string[][] = [];

    // Try API first
    try {
      const recResult = await fetchGeminiRecommendations(context, category, inputType, 10);
      if (recResult.success && recResult.recommendations?.length) {
        recommendations = recResult.recommendations;
        console.log(`✅ Auto-scheduler: Got ${recommendations.length} recommendations from API`);
      } else {
        throw new Error('API failed or no recommendations');
      }
    } catch (error) {
      console.log(`⚠️ Auto-scheduler: API failed, using fallback data. Error: ${error}`);
      // Use fallback data
      const categoryData = fallbackData[category] || fallbackData['General'];
      recommendations = categoryData[inputType] || categoryData['word'];
      console.log(`🔄 Auto-scheduler: Using ${recommendations.length} fallback recommendations`);
    }

    const word = recommendations[0];
    
    // Try API for synonyms
    try {
      const synResult = await fetchGeminiSynonyms(context, word);
      if (synResult.success && synResult.synonyms?.length) {
        synonyms = synResult.synonyms;
        console.log(`✅ Auto-scheduler: Got ${synonyms.length} synonym groups from API`);
      } else {
        throw new Error('API failed or no synonyms');
      }
    } catch (error) {
      console.log(`⚠️ Auto-scheduler: Synonyms API failed, using fallback. Error: ${error}`);
      // Use fallback synonyms
      synonyms = (fallbackSynonyms as any)[word.toUpperCase()] || [
        ['think', 'guess', 'solve', 'answer'],
        ['brain', 'mind', 'logic', 'reason'], 
        ['puzzle', 'mystery', 'riddle', 'challenge'],
        ['find', 'discover', 'reveal', 'uncover']
      ];
      console.log(`🔄 Auto-scheduler: Using fallback synonyms for ${word}`);
    }

    const gifUrls: string[] = [];
    for (const synonymGroup of synonyms.slice(0, 4)) {
      const term = synonymGroup[0];
      const gifs = await searchTenorGifs(context, term, 1);
      const gifUrl = gifs[0]?.media_formats?.tinygif?.url;
      if (gifUrl) gifUrls.push(gifUrl);
    }

    if (gifUrls.length !== 4) {
      console.log(`❌ Auto-scheduler: Only got ${gifUrls.length} GIFs, need 4. Aborting.`);
      return;
    }

    console.log(`✅ Auto-scheduler: Successfully got 4 GIFs, creating game with word: ${word}`);
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

    console.log(`🎉 Auto-scheduler: Successfully created and posted game!`);
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