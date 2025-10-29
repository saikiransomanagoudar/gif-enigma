import { Devvit, ScheduledJobEvent, JobContext, Context } from '@devvit/public-api';
import { fetchGeminiRecommendations, fetchGeminiSynonyms } from './geminiApi.server.js';
import { searchTenorGifs } from './tenorApi.server.js';
import { removeSystemUsersFromLeaderboard, saveGame } from './gameHandler.server.js';
import type { CategoryType } from '../shared.js';

const categories: CategoryType[] = ['Movies', 'Gaming', 'Books', 'General'];
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Weighted random selection: 80% word, 20% phrase
const pickInputType = (): 'word' | 'phrase' => {
  return Math.random() < 0.8 ? 'word' : 'phrase';
};

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
  onRun: async (event: ScheduledJobEvent<{ force?: boolean } | undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;

    // Check if this is a forced/manual run first
    const force = Boolean(event?.data && (event.data as any).force);

    // Subreddit guard: only run in production subreddit (unless forced)
    if (!force) {
      try {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const subredditName = subreddit.name.toLowerCase();        
        if (subredditName !== 'playgifenigma') {
          return;
        }
      } catch (error) {
        return;
      }
    }

    // Time guard: only proceed at 09:00, 14:00, and 19:00 America/Chicago (unless forced)
    if (!force) {
      try {
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }).format(now);
        const [hhStr, mmStr] = timeStr.split(':');
        const hour = Number(hhStr);
        const minute = Number(mmStr);

        if (!((hour === 9 || hour === 19) && minute === 0)) {
          return;
        }

        // Idempotency lock: ensure only one post per allowed CT hour
        const dateParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false,
        })
          .formatToParts(now)
          .reduce((acc: any, p) => {
            if (p.type !== 'literal') acc[p.type] = p.value;
            return acc;
          }, {} as any);

        const yyyy = dateParts.year;
        const mm = dateParts.month;
        const dd = dateParts.day;
        const hh = dateParts.hour; // 00-23 in CT
        const lockKey = `autoPostLock:${yyyy}-${mm}-${dd}:${hh}`;

        try {
          // @ts-ignore Devvit Redis supports NX/EX options
          const setResult = await (context as any).redis.set(lockKey, '1', {
            nx: true,
            ex: 7200, // 2 hours expiry to be safe across delays
          });
          if (!setResult) {
            return; // lock already held; another worker posted
          }
        } catch (_lockErr) {
          // If locking fails unexpectedly, fail-open would risk duplicates; returning is safer
          return;
        }
      } catch (tzErr) {
        
      }
    }

    const category = pickRandom(categories);
    const inputType = pickInputType();

    

    let recommendations: string[] = [];
    let synonyms: string[][] = [];

    // Try API first
    try {
      const recResult = await fetchGeminiRecommendations(context, category, inputType, 10);
      if (recResult.success && recResult.recommendations?.length) {
        recommendations = recResult.recommendations;
        
      } else {
        throw new Error('API failed or no recommendations');
      }
    } catch (error) {
      
      // Use fallback data
      const categoryData = fallbackData[category] || fallbackData['General'];
      recommendations = categoryData[inputType] || categoryData['word'];
      
    }

    const word = recommendations[0];
    
    // Try API for synonyms
    try {
      const synResult = await fetchGeminiSynonyms(context, word);
      if (synResult.success && synResult.synonyms?.length) {
        synonyms = synResult.synonyms;
        
      } else {
        throw new Error('API failed or no synonyms');
      }
    } catch (error) {
      
      // Use fallback synonyms
      synonyms = (fallbackSynonyms as any)[word.toUpperCase()] || [
        ['think', 'guess', 'solve', 'answer'],
        ['brain', 'mind', 'logic', 'reason'], 
        ['puzzle', 'mystery', 'riddle', 'challenge'],
        ['find', 'discover', 'reveal', 'uncover']
      ];
      
    }

    const gifUrls: string[] = [];
    for (const synonymGroup of synonyms.slice(0, 4)) {
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
        ? 'Can you decode the phrase from this GIF?'
        : 'Can you decode the word from this GIF?';

    await saveGame(
      {
        word,
        maskedWord,
        category,
        questionText,
        gifs: gifUrls,
        postToSubreddit: true,
        inputType,
      },
      context
    );

    
  },
});

Devvit.addSchedulerJob({
  name: 'clean_leaderboards',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;
    
    await removeSystemUsersFromLeaderboard(context);
  },
});

Devvit.addSchedulerJob({
  name: 'cache_prewarmer',
  onRun: async (_event: ScheduledJobEvent<undefined>, rawContext: JobContext) => {
    const context = rawContext as unknown as Context;
    
    try {
      const { preWarmCache } = await import('./cachePreWarmer.js');
      await preWarmCache(context);
    } catch (error) {
      // Silently handle cache prewarming errors
    }
  },
});