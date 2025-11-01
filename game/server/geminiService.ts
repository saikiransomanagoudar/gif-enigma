// server/geminiService.ts
import { Context } from '@devvit/public-api';
import { CategoryType } from '../pages/CategoryPage';

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  promptFeedback?: any;
  error?: any;
}

export async function getRecommendations(
  params: {
    category: CategoryType;
    inputType: 'word' | 'phrase';
    count?: number;
  },
  context: Context
): Promise<{ success: boolean; recommendations?: string[]; error?: string; debug?: any }> {
  try {
    const { category, inputType, count = 20 } = params;

    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured',
        recommendations: getDefaultRecommendations(category, inputType),
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 1000);

    const prompt =
      inputType === 'word'
        ? `Generate ${count} DIVERSE single words that would yield EXCELLENT ANIMATED GIFs when searched on Tenor related to ${category}. 
    ${
      category === 'Movies'
        ? 'Include a balanced mix of the following: (1) THEMATIC ELEMENTS from movies (like "revenge", "journey", "escape", "destiny"), (2) CONCEPTS that appear in films (like "villain", "monsters", "rescue", "betrayal"), (3) EMOTIONS depicted in cinema (like "terrified", "heartbreak", "triumph", "despair"), (4) COMMON SETTINGS or OBJECTS from films (like "spaceship", "treasure", "castle", "weapon"), and (5) some CHARACTER ARCHETYPES (like "heroes", "zombie", "cowboy", "warrior"). Focus on CINEMATIC and DRAMATIC words that relate to movie storytelling and film narratives. AVOID generic internet slang or modern meme terms (like "awkward", "cringe", "vibes", "salty", "hype") - those belong in Pop Culture. Avoid using specific film titles that would make guessing too obvious when paired with related GIFs.'
        : category === 'Gaming'
          ? 'Include a balanced mix of the following: (1) GAMING CONCEPTS (like "victory", "mission", "quest", "champion"), (2) GAME MECHANICS (like "puzzle", "stealth", "combat", "upgrade"), (3) COMMON GAME ELEMENTS (like "health", "treasure", "weapon", "potion"), (4) GAMING ENVIRONMENTS (like "dungeon", "fortress", "jungle", "arena"), and (5) some CHARACTER TYPES (like "wizard", "sniper", "zombie", "warrior"). Focus on VIDEO GAME and GAMING-SPECIFIC terminology. AVOID generic internet slang or meme culture terms (like "awkward", "cringe", "vibes", "salty") - those belong in Pop Culture. Avoid using specific game titles that would make guessing too obvious when paired with related GIFs.'
          : category === 'Books'
            ? 'Include a balanced mix of the following: (1) LITERARY THEMES (like "journey", "mystery", "romance", "destiny"), (2) LITERARY SETTINGS (like "castle", "island", "school", "mansion"), (3) CHARACTER TYPES in literature (like "wizard", "detective", "monster", "scholar"), (4) LITERARY DEVICES (like "tragedy", "suspense", "conflict", "metaphor"), and (5) GENRES (like "fantasy", "mystery", "western", "thriller"). Focus on LITERARY and BOOKISH words related to storytelling and reading. AVOID generic internet slang or meme terms (like "awkward", "cringe", "vibes", "salty") - those belong in Pop Culture. Avoid using specific book titles that would make guessing too obvious when paired with related GIFs.'
            : category === 'Pop Culture'
              ? 'Include a balanced mix of the following: (1) VIRAL TRENDS and MEMES (like "rizz", "sigma", "bussin", "slay", "glazing"), (2) INTERNET SLANG and EXPRESSIONS (like "unhinged", "no cap", "sus", "vibe check", "delulu"), (3) POPULAR REACTIONS (like "side eye", "mic drop", "face palm", "shock", "cringe"), (4) SOCIAL MEDIA MOMENTS (like "main character", "plot twist", "glow up", "tea spill"), and (5) ICONIC INTERNET CULTURE (like "rickroll", "awkward", "salty", "flexing", "iconic"). Focus exclusively on INTERNET CULTURE, MEMES, and SOCIAL MEDIA terminology. AVOID cinematic/dramatic terms (like "revenge", "betrayal", "destiny"), gaming terms (like "quest", "dungeon", "warrior"), or literary terms (like "mystery", "tragedy") - those belong in other categories.'
              : 'Include visually expressive concepts, action-oriented terms, and emotion-evoking ideas that produce great GIFs.'
    } 
    All words must be at least 5 characters long and safe for all audiences (not NSFW).
    DO NOT include any punctuation marks (no exclamation marks, question marks, periods, commas, etc.) in the words.
    
    IMPORTANT GIF SEARCH OPTIMIZATION:
    - Choose words that have VISUAL APPEAL when animated
    - Include terms commonly found in popular GIFs and memes
    - Focus on ACTIONS, REACTIONS, and EMOTIONS that animate well
    - Select words that have clear visual representations
    - Include pop culture references that appear frequently in GIFs
    - Avoid abstract concepts that don't translate well to visual media
    - Use randomization seed ${randomSeed} and timestamp ${timestamp} for variety
    
    Return your answer ONLY as a JSON array of strings. No explanation, no formatting, just a valid JSON array. For example: ["word1", "word2", "word3"]`
        : `Generate ${count} DIVERSE phrases (each with a minimum of two words) that would yield EXCELLENT ANIMATED GIFs when searched on Tenor related to ${category}. 
    ${
      category === 'Movies'
        ? 'Include a balanced mix of the following: (1) MOVIE SCENARIOS (like "car chase", "plot twist", "epic battle", "love story"), (2) CINEMATIC TECHNIQUES (like "slow motion", "jump scare", "dream sequence", "flashback"), (3) COMMON FILM MOMENTS (like "big reveal", "final boss", "sad ending", "hero moment"), (4) FILM REFERENCES that would create interesting GIF challenges (like "mind blown", "plot armor", "bad acting", "cliffhanger"). Focus on MOVIE-SPECIFIC scenarios and cinematic storytelling. AVOID generic internet/meme phrases (like "mic drop", "side eye", "vibe check", "glow up") - those belong in Pop Culture. Avoid using direct movie titles and main character names that would make guessing too obvious when paired with related GIFs.'
        : category === 'Gaming'
          ? 'Include a balanced mix of the following: (1) GAMING ACTIONS (like "level up", "game over", "boss fight", "power up"), (2) PLAYER EXPERIENCES (like "rage quit", "epic win", "clutch save", "noob move"), (3) GAMING MECHANICS (like "power move", "combo hit", "skill tree", "spawn point"), (4) GAMING SCENARIOS (like "secret level", "final form", "cut scene", "speed run"). Focus on VIDEO GAME-SPECIFIC actions and gaming experiences. AVOID generic internet/meme phrases (like "mic drop", "side eye", "vibe check", "face palm") - those belong in Pop Culture. Avoid using direct game titles and specific character names that would make guessing too obvious when paired with related GIFs.'
          : category === 'Books'
            ? 'Include a balanced mix of the following: (1) READING THEMES (like "plot twist", "main quest", "epic tale", "love story"), (2) LITERARY TECHNIQUES (like "big reveal", "time jump", "dual narrative", "flashback"), (3) STORY MOMENTS (like "dark secret", "true love", "final battle", "hero quest"), (4) BOOKISH CONCEPTS (like "plot armor", "red herring", "tragic hero", "cliffhanger"). Focus on LITERARY and STORYTELLING phrases specific to books and reading. AVOID generic internet/meme phrases (like "mic drop", "side eye", "vibe check", "glow up") - those belong in Pop Culture. Avoid using direct book titles and specific character names that would make guessing too obvious when paired with related GIFs.'
            : category === 'Pop Culture'
              ? 'Include a balanced mix of the following: (1) VIRAL MEME PHRASES (like "mic drop", "side eye", "main character", "chef kiss", "no cap"), (2) TRENDING EXPRESSIONS (like "vibe check", "glow up", "hot take", "era check", "ate that"), (3) REACTION MOMENTS (like "face palm", "jaw drop", "eye roll", "shade throw", "tea spill"), (4) INTERNET CULTURE REFERENCES (like "flex hard", "epic fail", "go viral", "ratio time", "touch grass"). Focus exclusively on INTERNET SLANG, MEMES, and SOCIAL MEDIA phrases. AVOID cinematic storytelling phrases (like "plot twist", "big reveal"), gaming terms (like "level up", "boss fight"), or literary concepts - those belong in other categories.'
              : 'Include reaction phrases, expressive actions, and visual concepts that produce great GIFs.'
    } 
    Each phrase must be at least 5 characters and at most 15 characters including spaces long and safe for all audiences (not NSFW).
    DO NOT include any punctuation marks (no exclamation marks, question marks, periods, commas, etc.) in the phrases.
    
    IMPORTANT GIF SEARCH OPTIMIZATION:
    - Focus on phrases that describe ACTIONS or REACTIONS (like "mind blown" or "happy dance")
    - Include popular meme phrases that are frequently made into GIFs
    - Choose phrases that have clear visual representations
    - Include phrases from viral videos, TV shows, or movies that became GIFs
    - Focus on dynamic content rather than static concepts
    - Consider what phrases people actually search for when looking for reaction GIFs
    - Use randomization seed ${randomSeed} and timestamp ${timestamp} for variety
    
    Return your answer ONLY as a JSON array of strings. No explanation, no formatting, just a valid JSON array. For example: ["phrase1", "phrase2", "phrase3"]`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.88,
        maxOutputTokens: 200,
        topP: 0.93,
        topK: 45,
        responseMimeType: 'application/json',
      },
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
          recommendations: getDefaultRecommendations(category, inputType),
          debug: { status: response.status, error: errorText },
        };
      }

      const data = (await response.json()) as GeminiResponse;

      // Add more detailed logging of the response structure
      const responseStructure = {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        hasContent: !!data.candidates?.[0]?.content,
        hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text,
        textPreview: data.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100),
        hasError: !!data.error,
      };

      // Attempt to parse the text from data.candidates[0].content.parts[0].text
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        let recommendations: string[] = [];
        let parseSuccessful = false;

        // Strategy 1: Try direct JSON parse (wrapped in try-catch)
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            recommendations = parsed;
            parseSuccessful = true;
          }
        } catch (e) {
          // JSON parse failed, try other strategies
        }

        // Strategy 2: Look for a JSON array pattern and extract it
        if (!parseSuccessful) {
          try {
            // Match [ ... ] even if there's text before/after
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              const parsed = JSON.parse(arrayMatch[0]);
              if (Array.isArray(parsed)) {
                recommendations = parsed;
                parseSuccessful = true;
              }
            }
          } catch (e) {
            // Still failed, continue to next strategy
          }
        }

        // Strategy 3: Extract quoted strings manually (handles broken JSON)
        if (!parseSuccessful) {
          try {
            // Match both single and double quoted strings
            const stringMatches = text.match(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g);
            if (stringMatches && stringMatches.length > 0) {
              recommendations = stringMatches.map((m) => {
                // Remove outer quotes and unescape
                const unquoted = m.slice(1, -1);
                return unquoted.replace(/\\"/g, '"').replace(/\\'/g, "'");
              });
              parseSuccessful = true;
            }
          } catch (e) {
            // Manual extraction failed
          }
        }

        // Strategy 4: Last resort - split by commas and clean up
        if (!parseSuccessful) {
          try {
            // Remove [ ] and split by comma
            const cleaned = text.replace(/[\[\]]/g, '');
            const items = cleaned.split(',').map(item => 
              item.trim().replace(/^["']|["']$/g, '')
            ).filter(item => item.length > 0);
            
            if (items.length > 0) {
              recommendations = items;
              parseSuccessful = true;
            }
          } catch (e) {
            // Even this failed
          }
        }

        if (parseSuccessful && recommendations.length > 0) {
          // Validate and clean array contents
          const validItems = recommendations
            .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
            .map((item: string) => item.trim().toUpperCase());
          
          if (validItems.length > 0) {
            return {
              success: true,
              recommendations: validItems,
              debug: { responseStructure, parseStrategy: 'success', originalLength: recommendations.length },
            };
          }
        }
      }

      // If we reach here, fallback
      return {
        success: false,
        error: 'Invalid response format',
        recommendations: getDefaultRecommendations(category, inputType),
        debug: { data },
      };
    } catch (fetchError) {
      return {
        success: false,
        error: `Fetch error: ${String(fetchError)}`,
        recommendations: getDefaultRecommendations(category, inputType),
        debug: { fetchError: String(fetchError) },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
      recommendations: getDefaultRecommendations(params.category, params.inputType),
      debug: { error: String(error) },
    };
  }
}

export async function getSynonyms(
  params: { word: string },
  context: Context
): Promise<{ success: boolean; synonyms?: string[][]; error?: string; debug?: any }> {
  const { word } = params; // ensure 'word' is in scope for the catch block

  try {

    // Get the API key from Devvit settings
    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured',
        synonyms: getDefaultSynonyms(word),
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 1000);

    const prompt = `For the word "${word}", generate four sets of HIGHLY EFFECTIVE Tenor GIF search terms, arranged from abstract to specific:

1. First set: Abstract/conceptual terms that would yield interesting GIFs indirectly related to "${word}" (3 terms)
2. Second set: Popular expressions, reactions, or emotions that relate to "${word}" and work well as GIF searches (3 terms)
3. Third set: Visual scenarios or popular media references relating to "${word}" that would make great GIFs (3 terms)
4. Fourth set: Direct and specific search terms for "${word}" that would yield the most relevant GIFs (3 terms)

IMPORTANT GUIDELINES FOR EFFECTIVE GIF SEARCH TERMS:
- Focus on VISUAL and ACTION-ORIENTED terms that would appear in GIFs
- Include popular memes, movie scenes, TV moments related to the concept
- Use terms that capture EMOTIONS and REACTIONS people express in GIFs
- Include terms that would yield animated content (not just static images)
- Consider what content creators would tag their GIFs with
- Use a mix of specific character names, show titles, and descriptive actions
- Favor concise, popular search terms that Tenor users would likely use
- Use timestamp ${timestamp} and seed ${randomSeed} to ensure variety

Return ONLY a valid JSON array of arrays with no additional text, formatting, or explanations.
Example format: [["term1","term2","term3"],["term4","term5","term6"],["term7","term8","term9"],["term10","term11","term12"]]`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 200,
        topP: 0.92,
        topK: 50,
        responseMimeType: 'application/json',
      },
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
          synonyms: getDefaultSynonyms(word),
          debug: { status: response.status, error: errorText },
        };
      }

      const data = (await response.json()) as GeminiResponse;

      // Log response structure
      const responseStructure = {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        hasContent: !!data.candidates?.[0]?.content,
        hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text,
        textPreview: data.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100),
        hasError: !!data.error,
      };


      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        let synonyms: string[][] = [];
        let parseSuccessful = false;

        // Strategy 1: Try direct JSON parse
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Validate it's an array of arrays
            if (parsed.every(item => Array.isArray(item))) {
              synonyms = parsed;
              parseSuccessful = true;
            }
          }
        } catch (e) {
          // JSON parse failed, try other strategies
        }

        // Strategy 2: Extract JSON array from text that might have extra content
        if (!parseSuccessful) {
          try {
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              const parsed = JSON.parse(arrayMatch[0]);
              if (Array.isArray(parsed) && parsed.length > 0) {
                synonyms = parsed;
                parseSuccessful = true;
              }
            }
          } catch (e) {
            // Still failed
          }
        }

        // Strategy 3: Manual extraction (last resort)
        if (!parseSuccessful) {
          try {
            // Look for nested arrays like [["a","b"],["c","d"]]
            const nestedArrayPattern = /\[([\s\S]*?)\]/g;
            const matches = [];
            let match;
            
            while ((match = nestedArrayPattern.exec(text)) !== null) {
              try {
                const innerArray = JSON.parse(match[0]);
                if (Array.isArray(innerArray) && innerArray.length > 0) {
                  matches.push(innerArray);
                }
              } catch (e) {
                // Skip invalid inner arrays
              }
            }
            
            if (matches.length > 0) {
              synonyms = matches;
              parseSuccessful = true;
            }
          } catch (e) {
            // Manual extraction failed
          }
        }

        if (parseSuccessful && synonyms.length > 0) {
          // Validate and clean the data
          const validSynonyms = synonyms
            .filter(group => Array.isArray(group) && group.length > 0)
            .map(group => 
              group
                .filter(item => typeof item === 'string' && item.trim().length > 0)
                .map(item => item.trim().toLowerCase())
            )
            .filter(group => group.length > 0);

          if (validSynonyms.length > 0) {
            return {
              success: true,
              synonyms: validSynonyms,
              debug: { responseStructure, parseStrategy: 'success' },
            };
          }
        }

        // If we got here, parsing failed - return fallback
        return {
          success: false,
          error: `Could not parse synonyms from response`,
          synonyms: getDefaultSynonyms(word),
          debug: { rawText: text.substring(0, 200) },
        };
      }

      return {
        success: false,
        error: 'Invalid response format for synonyms',
        synonyms: getDefaultSynonyms(word),
        debug: { data },
      };
    } catch (fetchError) {
      return {
        success: false,
        error: `Fetch error: ${String(fetchError)}`,
        synonyms: getDefaultSynonyms(word),
        debug: { fetchError: String(fetchError) },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
      synonyms: getDefaultSynonyms(word),
      debug: { error: String(error) },
    };
  }
}

function getDefaultRecommendations(category: CategoryType, type: 'word' | 'phrase'): string[] {
  if (type === 'word') {
    switch (category) {
      case 'Movies':
        return [
          'Avatar',
          'Titanic',
          'Matrix',
          'Inception',
          'Jaws',
          'Frozen',
          'Gladiator',
          'Avengers',
          'Psycho',
          'Shining',
        ];
      case 'Gaming':
        return [
          'Portal',
          'Tetris',
          'Minecraft',
          'Fortnite',
          'Mario',
          'Zelda',
          'Skyrim',
          'Halo',
          'in gem',
          'Pokemon',
        ];
      case 'Books':
        return [
          'Dracula',
          'Frankenstein',
          'Hamlet',
          'Odyssey',
          'Gatsby',
          'Hobbit',
          'Matilda',
          'Dune',
          'Moby',
          'Sherlock',
        ];
      case 'Pop Culture':
        return [
          'Rickroll',
          'Cringe',
          'Unhinged',
          'Awkward',
          'Hype',
          'Shocked',
          'Salty',
          'Flexing',
          'Vibes',
          'Iconic',
        ];
      default:
        return [
          'Mystery',
          'Secret',
          'Puzzle',
          'Riddle',
          'Hidden',
          'Enigma',
          'Cipher',
          'Clue',
          'Decode',
          'Reveal',
        ];
    }
  } else {
    switch (category) {
      case 'Movies':
        return [
          'Star Wars',
          'Harry Potter',
          'The Lord of the Rings',
          'Back to the Future',
          'Hunger Games',
          'James Bond',
          'The Dark Knight',
          'Pulp Fiction',
          'Wonder Woman',
          'Indiana Jones',
        ];
      case 'Gaming':
        return [
          'Final Fantasy',
          'Grand Theft Auto',
          'Call of Duty',
          'World of Warcraft',
          'Super Mario',
          'Legend of Zelda',
          'Mass Effect',
          'Metal Gear',
          'Counter Strike',
          'Street Fighter',
        ];
      case 'Books':
        return [
          'Pride and Prejudice',
          'The Great Gatsby',
          'Crime and Punishment',
          'Jane Eyre',
          'Moby Dick',
          'Oliver Twist',
          'David Copperfield',
          'Brave New World',
          'Paper Towns',
          'Game of Thrones',
        ];
      case 'Pop Culture':
        return [
          'Mic Drop',
          'Side Eye',
          'Plot Twist',
          'Glow Up',
          'Main Character',
          'Vibe Check',
          'Face Palm',
          'Mind Blown',
          'Epic Fail',
          'Hot Take',
        ];
      default:
        return [
          'Hidden Treasure',
          'Secret Message',
          'Magic Spell',
          'Golden Rule',
          'Perfect Storm',
          'Puzzle Box',
          'Silent Night',
          'Final Answer',
          'Quick Brown',
          'Lazy Dog',
        ];
    }
  }
}

function getDefaultSynonyms(word: string): string[][] {
  const wordLower = word.toLowerCase();

  const synonymMap: { [key: string]: string[][] } = {
    'avatar': [
      ['identity', 'persona', 'character'],
      ['blue', 'alien', 'pandora'],
      ['james cameron', 'science fiction', 'movie'],
      ['film character', 'blue avatar', "na'vi"],
    ],
    'titanic': [
      ['large', 'massive', 'enormous'],
      ['ship', 'vessel', 'ocean liner'],
      ['iceberg', 'disaster', 'sinking'],
      ['jack dawson', 'rose dewitt', 'james cameron'],
    ],
    'matrix': [
      ['grid', 'array', 'pattern'],
      ['code', 'virtual', 'simulation'],
      ['neo', 'keanu reeves', 'morpheus'],
      ['red pill', 'bullet time', 'trinity'],
    ],
    'star wars': [
      ['space', 'galaxy', 'universe'],
      ['lightsaber', 'jedi', 'force'],
      ['darth vader', 'luke skywalker', 'yoda'],
      ['death star', 'millennium falcon', 'stormtrooper'],
    ],
    'harry potter': [
      ['wizard', 'magic', 'wand'],
      ['hogwarts', 'school', 'spells'],
      ['voldemort', 'scar', 'hermione'],
      ['harry potter', 'ron weasley', 'dumbledore'],
    ],
    'coffee': [
      ['drink', 'beverage', 'cup'],
      ['caffeine', 'beans', 'morning'],
      ['espresso', 'latte', 'cappuccino'],
      ['coffee mug', 'coffee shop', 'barista'],
    ],
    'beach party': [
      ['sand', 'ocean', 'coast'],
      ['celebration', 'gathering', 'fun'],
      ['surfing', 'sunbathing', 'bonfire'],
      ['beach ball', 'beach umbrella', 'volleyball'],
    ],
  };

  return (
    synonymMap[wordLower] || [
      ['abstract', 'concept', 'idea'],
      ['related', 'similar', 'connected'],
      ['specific', 'direct', 'explicit'],
      ['exact', 'precise', 'identical'],
    ]
  );
}

// NEW: Get same-length semantic synonyms for validation
export async function getSemanticSynonyms(
  params: { word: string },
  context: Context
): Promise<{ success: boolean; synonyms?: string[]; error?: string; debug?: any }> {
  const { word } = params;

  try {
    // Get the API key from Devvit settings
    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured',
        synonyms: [],
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    // Calculate word length (without spaces/punctuation)
    const normalizedWord = word.replace(/\s+/g, '').replace(/[^\w]/g, '');
    const wordLength = normalizedWord.length;

    const prompt = `For the word or phrase "${word}", generate a list of SEMANTICALLY RELATED words or phrases that have EXACTLY ${wordLength} letters (excluding spaces and punctuation).

CRITICAL REQUIREMENTS:
1. Each synonym MUST have EXACTLY ${wordLength} letters when spaces and punctuation are removed
2. Include words that are LOOSELY RELATED or could be visually represented similarly in GIFs
3. Think broadly: related emotions, actions, expressions, situations, or concepts
4. Focus on words players might reasonably guess from a visual GIF representation
5. Include synonyms, related feelings, similar actions, and contextual connections
6. Generate at least 15-20 valid options if possible

Examples of LOOSE semantic connections we want:
- If word is "ENERGETIC" (9 letters), include: "SCREAMING", "CELEBRATE", "VIVACIOUS", "ANIMATED", "THRILLING"
- If word is "HAPPY" (5 letters), include: "JOLLY", "MERRY", "PEPPY", "CHEERY", "SUNNY"
- If word is "EXCITED" (7 letters), include: "AMPED UP", "PUMPED", "HYPED UP", "CHARGED", "THRILLED"
- If word is "RUNNING" (7 letters), include: "JOGGING", "RUSHING", "HURRIED", "DASHING", "SPRINTS"

Think of: emotions expressed, body language shown, energy levels, similar activities, related concepts, or visual interpretations.

Return ONLY a valid JSON array of strings with no additional text, formatting, or explanations.
Example format: ["synonym1", "synonym2", "synonym3", ...]

IMPORTANT: Each word in the array MUST have exactly ${wordLength} letters (excluding spaces/punctuation).`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        topP: 0.9,
        topK: 40,
        responseMimeType: 'application/json',
      },
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
          synonyms: [],
        };
      }

      const data = (await response.json()) as GeminiResponse;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        try {
          const parsed = JSON.parse(text);
          
          if (Array.isArray(parsed)) {
            // Filter to only include synonyms with the correct length
            const validSynonyms = parsed
              .filter((syn) => typeof syn === 'string')
              .map((syn) => syn.trim())
              .filter((syn) => {
                const normalized = syn.replace(/\s+/g, '').replace(/[^\w]/g, '');
                return normalized.length === wordLength;
              });

            return {
              success: true,
              synonyms: validSynonyms,
              debug: { 
                source: 'api',
                requested: wordLength,
                received: parsed.length,
                valid: validSynonyms.length
              },
            };
          }
        } catch (parseError) {
          return {
            success: false,
            error: `Parse error: ${String(parseError)}`,
            synonyms: [],
          };
        }
      }

      return {
        success: false,
        error: 'No valid response from API',
        synonyms: [],
      };
    } catch (fetchError) {
      return {
        success: false,
        error: `Fetch error: ${String(fetchError)}`,
        synonyms: [],
      };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
      synonyms: [],
    };
  }
}

/**
 * Validates if GIF descriptions match the secret word/phrase to avoid contradictions
 * @param word - The secret word or phrase
 * @param gifDescriptions - Array of actual GIF content descriptions from Tenor
 * @param searchTerms - Array of search terms used (for context)
 * @param context - Devvit context
 * @returns Validation result with match score and reasoning
 */
export async function validateGifWordMatch(
  params: {
    word: string; // Can be a word or phrase
    gifDescriptions: string[];
    searchTerms?: string[];
  },
  context: Context
): Promise<{ 
  success: boolean; 
  isValid: boolean; 
  matchScore: number; 
  reasoning?: string; 
  error?: string;
}> {
  try {
    const { word, gifDescriptions, searchTerms = [] } = params;

    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      // If no API key, allow the game (don't block)
      return {
        success: true,
        isValid: true,
        matchScore: 0.5,
        reasoning: 'Validation skipped - no API key',
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `Evaluate if these GIFs match the secret word or phrase for a GIF-guessing game with progressive hints.

SECRET WORD/PHRASE: "${word}"

GIF DESCRIPTIONS (from Tenor API):
${gifDescriptions.map((d, i) => `GIF ${i + 1}: "${d}"`).join('\n')}

SEARCH TERMS USED:
${searchTerms.map((t, i) => `[${i + 1}] "${t}"`).join(', ')}

GAME MECHANICS:
- GIF 1 is shown FIRST (most ABSTRACT hint) - should NOT contain the answer directly
- GIF 2, 3, 4 are progressive hints (increasingly direct) - unlocked if player struggles
- Players must guess the word/phrase based on visual hints only

VALIDATION RULES:

1. **GIF 1 (CRITICAL - First shown to player):**
   - MUST be abstract/indirect (emotions, actions, related concepts)
   - MUST NOT contain the secret word/phrase or direct words from it in the description
   - MUST NOT show text/letters spelling out the answer
   - Should evoke the feeling/concept without being obvious
   - For phrases: should represent the overall concept, not specific words

2. **GIFs 2-4 (Progressive hints):**
   - Can be more direct but still require thinking
   - Should progressively get clearer
   - Avoid exact word/phrase matches in descriptions
   - For phrases: can reference parts of the phrase but not the whole thing

3. **Overall Match:**
   - GIFs should represent related concepts, emotions, or visual interpretations
   - Should NOT contradict the word/phrase meaning (e.g., "depleted" vs "MISSION")
   - Should NOT be completely unrelated

SCORING:
- 0.9-1.0: Excellent - GIF 1 is abstract, progressively helpful, good match
- 0.7-0.8: Good - Minor issues but playable
- 0.5-0.6: Moderate - Acceptable but not ideal
- 0.3-0.4: Poor - GIF 1 too direct OR confusing hints
- 0.0-0.2: Bad - Contains answer in GIF 1 OR contradicts meaning

CRITICAL FAILURES (score < 0.5):
- GIF 1 description contains the secret word/phrase or key words from it
- GIF 1 shows text/letters spelling the answer
- GIFs show OPPOSITE meaning (e.g., "exhausted/depleted" for "ENERGETIC")
- Completely unrelated GIFs

Return ONLY a JSON object:
{
  "matchScore": 0.85,
  "isValid": true,
  "reasoning": "Brief explanation focusing on GIF 1 abstractness and overall match quality"
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
        topP: 0.8,
        topK: 20,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // If validation fails, allow the game (don't block)
      return {
        success: true,
        isValid: true,
        matchScore: 0.5,
        reasoning: 'Validation skipped - API error',
      };
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text.trim();

      try {
        const parsed = JSON.parse(text);

        if (
          typeof parsed === 'object' &&
          typeof parsed.matchScore === 'number' &&
          typeof parsed.isValid === 'boolean'
        ) {
          return {
            success: true,
            isValid: parsed.isValid,
            matchScore: parsed.matchScore,
            reasoning: parsed.reasoning || 'No reasoning provided',
          };
        }
      } catch (parseError) {
        // If parsing fails, allow the game
        return {
          success: true,
          isValid: true,
          matchScore: 0.5,
          reasoning: 'Validation skipped - parse error',
        };
      }
    }

    // Default to allowing the game if validation is inconclusive
    return {
      success: true,
      isValid: true,
      matchScore: 0.5,
      reasoning: 'Validation skipped - no valid response',
    };
  } catch (error) {
    // If any error occurs, allow the game (fail-safe)
    return {
      success: true,
      isValid: true,
      matchScore: 0.5,
      reasoning: `Validation skipped - error: ${String(error)}`,
    };
  }
}
