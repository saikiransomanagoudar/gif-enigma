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
): Promise<{ success: boolean; recommendations?: string[]; error?: string }> {
  try {
    const { category, inputType, count = 10 } = params;

    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      console.error('Gemini API key not found in settings');
      return {
        success: false,
        error: 'API key not configured',
        recommendations: getDefaultRecommendations(category, inputType),
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const prompt =
      inputType === 'word'
        ? `Generate ${count} single words related to ${category} that would be good for a guessing game. Each word must be at least 5 characters long. Return only as a JSON array of strings with no explanation.`
        : `Generate ${count} phrases (each with a minimum of two words) related to ${category} that would be good for a guessing game. Each phrase must be at least 5 characters long. Return only as a JSON array of strings with no explanation.`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status}`,
        recommendations: getDefaultRecommendations(category, inputType),
      };
    }

    const data = (await response.json()) as GeminiResponse;

    // Attempt to parse the text from data.candidates[0].content.parts[0].text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      try {
        const recommendations = JSON.parse(text);
        if (Array.isArray(recommendations) && recommendations.length > 0) {
          return { success: true, recommendations };
        }
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
      }
    }

    // If we reach here, fallback
    return {
      success: false,
      error: 'Invalid response format',
      recommendations: getDefaultRecommendations(category, inputType),
    };
  } catch (error) {
    console.error('Error fetching recommendations from Gemini:', error);
    return {
      success: false,
      error: String(error),
      recommendations: getDefaultRecommendations(params.category, params.inputType),
    };
  }
}

export async function getSynonyms(
  params: { word: string },
  context: Context
): Promise<{ success: boolean; synonyms?: string[][]; error?: string }> {
  const { word } = params; // ensure 'word' is in scope for the catch block

  try {
    // Get the API key from Devvit settings
    const apiKey = await context.settings.get('gemini-api-key');

    if (!apiKey) {
      console.error('Gemini API key not found in settings');
      return {
        success: false,
        error: 'API key not configured',
        synonyms: getDefaultSynonyms(word),
      };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `For the word "${word}", generate four sets of search terms that could be used to find related GIFs, arranged from abstract/indirect to very specific:
1. First set: Extremely abstract or conceptual terms (3 terms)
2. Second set: Somewhat related but still indirect terms (3 terms)
3. Third set: More direct and closer to the word (3 terms)
4. Fourth set: Very specific and direct terms (3 terms)
Return only as a JSON array of arrays with no explanation.`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status}`,
        synonyms: getDefaultSynonyms(word),
      };
    }

    const data = (await response.json()) as GeminiResponse;

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      try {
        const synonyms = JSON.parse(text);
        if (Array.isArray(synonyms) && synonyms.length > 0) {
          return { success: true, synonyms };
        }
      } catch (parseError) {
        console.error('Error parsing synonyms JSON:', parseError);
      }
    }

    return {
      success: false,
      error: 'Invalid response format',
      synonyms: getDefaultSynonyms(word),
    };
  } catch (error) {
    console.error('Error fetching synonyms from Gemini:', error);
    return {
      success: false,
      error: String(error),
      synonyms: getDefaultSynonyms(word),
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
    ],
    'titanic': [
      ['large', 'massive', 'enormous'],
      ['ship', 'vessel', 'ocean liner'],
      ['iceberg', 'disaster', 'sinking'],
    ],
    'matrix': [
      ['grid', 'array', 'pattern'],
      ['code', 'virtual', 'simulation'],
      ['neo', 'keanu reeves', 'morpheus'],
    ],
    'star wars': [
      ['space', 'galaxy', 'universe'],
      ['lightsaber', 'jedi', 'force'],
      ['darth vader', 'luke skywalker', 'millennium falcon'],
    ],
    'harry potter': [
      ['wizard', 'magic', 'wand'],
      ['hogwarts', 'school', 'spells'],
      ['voldemort', 'scar', 'hermione'],
    ],
    'coffee': [
      ['drink', 'beverage', 'cup'],
      ['caffeine', 'beans', 'morning'],
      ['espresso', 'latte', 'cappuccino'],
    ],
    'beach party': [
      ['sand', 'ocean', 'coast'],
      ['celebration', 'gathering', 'fun'],
      ['surfing', 'sunbathing', 'bonfire'],
    ],
  };

  return (
    synonymMap[wordLower] || [
      ['abstract', 'concept', 'basic idea'],
      ['related objects', 'context', 'examples'],
      ['direct hint', 'obvious reference', 'clear connection'],
    ]
  );
}
