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
        ? 'Include a balanced mix of the following: (1) THEMATIC ELEMENTS from movies (like "revenge", "journey", "escape"), (2) CONCEPTS that appear in films (like "villain", "monsters", "rescue"), (3) EMOTIONS depicted in cinema (like "terrified", "heartbreak", "triumph"), (4) COMMON SETTINGS or OBJECTS from films (like "spaceship", "treasure", "castle"), and (5) some CHARACTER ARCHETYPES (like "heroes", "zombie", "cowboy"). Avoid using specific film titles that would make guessing too obvious when paired with related GIFs.'
        : category === 'Gaming'
          ? 'Include a balanced mix of the following: (1) GAMING CONCEPTS (like "victory", "mission", "quest"), (2) GAME MECHANICS (like "puzzle", "stealth", "combat"), (3) COMMON GAME ELEMENTS (like "health", "treasure", "weapon"), (4) GAMING ENVIRONMENTS (like "dungeon", "fortress", "jungle"), and (5) some CHARACTER TYPES (like "wizard", "sniper", "zombie"). Avoid using specific game titles that would make guessing too obvious when paired with related GIFs.'
          : category === 'Books'
            ? 'Include a balanced mix of the following: (1) LITERARY THEMES (like "journey", "mystery", "romance"), (2) LITERARY SETTINGS (like "castle", "island", "school"), (3) CHARACTER TYPES in literature (like "wizard", "detective", "monster"), (4) LITERARY DEVICES (like "tragedy", "suspense", "conflict"), and (5) GENRES (like "fantasy", "mystery", "western"). Avoid using specific book titles that would make guessing too obvious when paired with related GIFs.'
            : 'Include visually expressive concepts, action-oriented terms, and emotion-evoking ideas that produce great GIFs.'
    } 
    All words must be at least 5 characters long and safe for all audiences (not NSFW).
    
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
        ? 'Include a balanced mix of the following: (1) MOVIE SCENARIOS (like "car chase", "plot twist", "epic battle"), (2) CINEMATIC TECHNIQUES (like "slow motion", "jump scare", "dream sequence"), (3) COMMON FILM MOMENTS (like "big reveal", "final boss", "sad ending"), (4) FILM REFERENCES that would create interesting GIF challenges (like "mind blown", "plot armor", "bad acting"). Avoid using direct movie titles and main character names that would make guessing too obvious when paired with related GIFs.'
        : category === 'Gaming'
          ? 'Include a balanced mix of the following: (1) GAMING ACTIONS (like "level up", "game over", "boss fight"), (2) PLAYER EXPERIENCES (like "rage quit", "epic win", "clutch save"), (3) GAMING MECHANICS (like "power move", "combo hit", "skill tree"), (4) GAMING SCENARIOS (like "secret level", "final form", "cut scene"). Avoid using direct game titles and specific character names that would make guessing too obvious when paired with related GIFs.'
          : category === 'Books'
            ? 'Include a balanced mix of the following: (1) READING THEMES (like "plot twist", "main quest", "epic tale"), (2) LITERARY TECHNIQUES (like "big reveal", "time jump", "dual narrative"), (3) STORY MOMENTS (like "dark secret", "true love", "final battle"), (4) BOOKISH CONCEPTS (like "plot armor", "red herring", "tragic hero"). Avoid using direct book titles and specific character names that would make guessing too obvious when paired with related GIFs.'
            : 'Include reaction phrases, expressive actions, and visual concepts that produce great GIFs.'
    } 
    Each phrase must be at least 5 characters and at most 15 characters including spaces long and safe for all audiences (not NSFW).
    
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
      case 'General':
        return [
          'Coffee',
          'Planet',
          'Desert',
          'Camera',
          'Forest',
          'Guitar',
          'Dolphin',
          'Stadium',
          'Market',
          'Castle',
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
      case 'General':
        return [
          'Beach Party',
          'Winter Storm',
          'Secret Garden',
          'Mountain View',
          'Ocean Wave',
          'Desert Bloom',
          'City Lights',
          'Forest Trail',
          'Music Festival',
          'Remote Island',
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
