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
    const { category, inputType, count = 10 } = params;

    // Add debug log
    console.log(`[DEBUG] Getting recommendations for category: ${category}, type: ${inputType}, count: ${count}`);

    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      console.error('[ERROR] Gemini API key not found in settings');
      return {
        success: false,
        error: 'API key not configured',
        recommendations: getDefaultRecommendations(category, inputType),
      };
    }

    console.log('[DEBUG] API key found, proceeding with request');

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const prompt =
    inputType === 'word'
    ? `Generate ${count} single words related to ${category}. ${
        category === 'Movies'
          ? 'Include film titles, characters, and quotes, and inspirational movie quotes.'
          : category === 'Gaming'
          ? 'Include games, characters, and gaming terms, and inspirational gaming quotes.'
          : category === 'Books'
          ? 'Include titles, authors, characters, and quotes, and inspirational quotes.'
          : 'Topics include anything and everything, and also inspirational..'
      } All words must be at least 5 characters long and safe for all audiences (not NSFW). Return only as a JSON array of strings with no explanation.`
    : `Generate ${count} phrases (each with a minimum of two words) related to ${category}. ${
        category === 'Movies'
          ? 'Include film titles, characters, and quotes, and also inspirational movie quotes.'
          : category === 'Gaming'
          ? 'Include games, characters, and gaming terms, and also inspirational gaming quotes.'
          : category === 'Books'
          ? 'Include titles, authors, characters, quotes, inspirational quotes.'
          : 'Topics include anything and everything, and also inspirational.'
      } Each phrase must be at least 5 characters and at most 15 characters including spaces long and safe for all audiences (not NSFW). Return only as a JSON array of strings with no explanation.`;
  
    console.log(`[DEBUG] Prompt: ${prompt.substring(0, 100)}...`);

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
        maxOutputTokens: 200,
        topP: 0.95,
        responseMimeType: 'application/json',
      },
    };

    console.log('[DEBUG] Sending request to Gemini API');
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[DEBUG] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ERROR] Gemini API error (${response.status}): ${errorText}`);
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
          recommendations: getDefaultRecommendations(category, inputType),
          debug: { status: response.status, error: errorText },
        };
      }

      const data = (await response.json()) as GeminiResponse;
      console.log('[DEBUG] Received response from Gemini API');

      // Add more detailed logging of the response structure
      const responseStructure = {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        hasContent: !!data.candidates?.[0]?.content,
        hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text,
        textPreview: data.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100),
        hasError: !!data.error,
      };
      
      console.log('[DEBUG] Response structure:', JSON.stringify(responseStructure));

      // Attempt to parse the text from data.candidates[0].content.parts[0].text
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          console.log(`[DEBUG] Attempting to parse response text: ${text.substring(0, 100)}...`);
          const recommendations = JSON.parse(text);
          
          if (Array.isArray(recommendations) && recommendations.length > 0) {
            console.log(`[DEBUG] Successfully parsed ${recommendations.length} recommendations`);
            return { 
              success: true, 
              recommendations,
              debug: { responseStructure } 
            };
          } else {
            console.error('[ERROR] Parsed response is not a valid array or is empty');
          }
        } catch (parseError) {
          console.error('[ERROR] Error parsing Gemini response:', parseError);
          console.log('[DEBUG] Raw text that failed to parse:', text);
          return {
            success: false,
            error: `Parse error: ${String(parseError)}`,
            recommendations: getDefaultRecommendations(category, inputType),
            debug: { parseError: String(parseError), rawText: text },
          };
        }
      } else {
        console.error('[ERROR] No text found in Gemini response');
      }

      // If we reach here, fallback
      return {
        success: false,
        error: 'Invalid response format',
        recommendations: getDefaultRecommendations(category, inputType),
        debug: { data },
      };
    } catch (fetchError) {
      console.error('[ERROR] Fetch error:', fetchError);
      return {
        success: false,
        error: `Fetch error: ${String(fetchError)}`,
        recommendations: getDefaultRecommendations(category, inputType),
        debug: { fetchError: String(fetchError) },
      };
    }
  } catch (error) {
    console.error('[ERROR] Error in getRecommendations:', error);
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
    console.log(`[DEBUG] Getting synonyms for word: ${word}`);
    
    // Get the API key from Devvit settings
    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      console.error('[ERROR] Gemini API key not found in settings');
      return {
        success: false,
        error: 'API key not configured',
        synonyms: getDefaultSynonyms(word),
      };
    }

    console.log('[DEBUG] API key found for synonyms request');

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `For the word "${word}", generate four sets of search terms that could be used to find related GIFs, arranged from abstract/indirect to very specific:
1. First set: Extremely abstract or conceptual terms (3 terms)
2. Second set: Somewhat related but still indirect terms (3 terms)
3. Third set: More direct and closer to the word (3 terms)
4. Fourth set: Very specific and direct terms (3 terms)
Return only as a JSON array of arrays with no explanation.`;

    console.log(`[DEBUG] Synonyms prompt: ${prompt.substring(0, 100)}...`);

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
        maxOutputTokens: 200,
        topP: 0.95,
        responseMimeType: 'application/json',
      },
    };

    console.log('[DEBUG] Sending synonyms request to Gemini API');
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[DEBUG] Synonyms response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ERROR] Gemini API error for synonyms (${response.status}): ${errorText}`);
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
          synonyms: getDefaultSynonyms(word),
          debug: { status: response.status, error: errorText },
        };
      }

      const data = (await response.json()) as GeminiResponse;
      console.log('[DEBUG] Received synonyms response from Gemini API');

      // Log response structure
      const responseStructure = {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        hasContent: !!data.candidates?.[0]?.content,
        hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text,
        textPreview: data.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100),
        hasError: !!data.error,
      };
      
      console.log('[DEBUG] Synonyms response structure:', JSON.stringify(responseStructure));

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          console.log(`[DEBUG] Attempting to parse synonyms text: ${text.substring(0, 100)}...`);
          const synonyms = JSON.parse(text);
          
          if (Array.isArray(synonyms) && synonyms.length > 0) {
            console.log(`[DEBUG] Successfully parsed ${synonyms.length} synonym groups`);
            return { 
              success: true, 
              synonyms,
              debug: { responseStructure } 
            };
          } else {
            console.error('[ERROR] Parsed synonyms response is not a valid array or is empty');
          }
        } catch (parseError) {
          console.error('[ERROR] Error parsing synonyms JSON:', parseError);
          console.log('[DEBUG] Raw synonyms text that failed to parse:', text);
          return {
            success: false,
            error: `Parse error: ${String(parseError)}`,
            synonyms: getDefaultSynonyms(word),
            debug: { parseError: String(parseError), rawText: text },
          };
        }
      } else {
        console.error('[ERROR] No text found in Gemini synonyms response');
      }

      return {
        success: false,
        error: 'Invalid response format for synonyms',
        synonyms: getDefaultSynonyms(word),
        debug: { data },
      };
    } catch (fetchError) {
      console.error('[ERROR] Fetch error for synonyms:', fetchError);
      return {
        success: false,
        error: `Fetch error: ${String(fetchError)}`,
        synonyms: getDefaultSynonyms(word),
        debug: { fetchError: String(fetchError) },
      };
    }
  } catch (error) {
    console.error('[ERROR] Error in getSynonyms:', error);
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
          'Sonic',
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
      ['film character', 'blue avatar', 'na\'vi'],
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