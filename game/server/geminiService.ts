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

    // Add debug log
    console.log(
      `[DEBUG] Getting recommendations for category: ${category}, type: ${inputType}, count: ${count}`
    );

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

    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 1000);

    const prompt =
      inputType === 'word'
        ? `Generate ${count} DIVERSE single words that would yield EXCELLENT ANIMATED GIFs when searched on Tenor related to ${category}. 
    ${
      category === 'Movies'
        ? 'Include iconic film moments, expressive characters, memorable movie scenes, visual movie concepts, and action sequences that translate well to GIFs.'
        : category === 'Gaming'
          ? 'Include game characters in action, victory/defeat moments, iconic gaming moves, game memes, and memorable gaming scenes that make great GIFs.'
          : category === 'Books'
            ? 'Include visually adaptable book characters, dramatic book scenes that have been filmed, book-to-movie moments, and expressive literary concepts.'
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
        ? 'Include iconic film quotes, character reactions, movie scene descriptions, and visual moments that are popular in GIF format.'
        : category === 'Gaming'
          ? 'Include gaming catchphrases, character actions, game moments, and gaming memes that are commonly found as GIFs.'
          : category === 'Books'
            ? 'Include book quotes that have been adapted to film, character moments, and dramatic scenes that would appear in GIF format.'
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
        console.log('[DEBUG] Raw API response text:', text); // Added logging

        let sanitizedText = text;

        let recommendations = [];
        let parseSuccessful = false;

        // First parse attempt
        try {
          console.log('[DEBUG] Attempting to parse sanitized text:', sanitizedText);
          recommendations = JSON.parse(sanitizedText);
          parseSuccessful = Array.isArray(recommendations);
        } catch (primaryError) {
          console.log('[DEBUG] Primary parse failed, attempting fallback');
        }

        if (!parseSuccessful) {
          // Look for anything that looks like a JSON array
          const arrayMatch = text.match(/\[\s*(['"][^'"]*['"](\s*,\s*['"][^'"]*['"])*)\s*\]/s);
          if (arrayMatch) {
            try {
              const extractedArray = `[${arrayMatch[1]}]`;
              console.log('[DEBUG] Extracted array text:', extractedArray);
              recommendations = JSON.parse(extractedArray);
              parseSuccessful = Array.isArray(recommendations);
            } catch (fallbackError) {
              console.error('[ERROR] Fallback parse failed:', fallbackError);
            }
          }

          // One more fallback - try to manually build the array
          if (!parseSuccessful) {
            try {
              // Extract anything that looks like a quoted string
              const itemMatches = text.match(/['"]([^'"]+)['"]/g);
              if (itemMatches && itemMatches.length > 0) {
                recommendations = itemMatches.map((m) => m.replace(/['"]/g, ''));
                parseSuccessful = true;
                console.log('[DEBUG] Manual array extraction successful:', recommendations);
              }
            } catch (manualError) {
              console.error('[ERROR] Manual extraction failed:', manualError);
            }
          }
        }

        if (parseSuccessful && recommendations.length > 0) {
          // Validate array contents
          const validItems = recommendations.filter((item: any) => typeof item === 'string');
          console.log(`[DEBUG] Found ${validItems.length} valid recommendations`);
          return {
            success: true,
            recommendations: validItems,
            debug: { responseStructure },
          };
        } else {
          console.error('[ERROR] Final parsed array invalid');
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
              debug: { responseStructure },
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
