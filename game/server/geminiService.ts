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
        ? `Generate ${count} DIVERSE single words that would yield EXCELLENT ANIMATED GIFs when searched on GIPHY related to ${category}. 
    ${category === 'Cinematic Feels'
          ? 'Include a balanced mix of the following: (1) EMOTION ADJECTIVES depicting cinematic feelings (like "TERRIFIED", "HEARTBROKEN", "TRIUMPHANT", "SHOCKED", "AMAZED", "DEVASTATED"), (2) ACTION GERUNDS showing movie dynamics (like "ESCAPING", "FIGHTING", "RESCUING", "EXPLODING", "CHASING", "TRANSFORMING"), (3) ABSTRACT EXPERIENCE NOUNS from storytelling (like "REVENGE", "BETRAYAL", "SACRIFICE", "REDEMPTION", "DESTINY"), (4) DYNAMIC STATES characters experience (like "DEFEATED", "VICTORIOUS", "HAUNTED", "DETERMINED"). Focus on EMOTIONS, ACTIONS, and EXPERIENCES that can be shown abstractly through reactions or directly through movie scenes. COMPLETELY AVOID: specific film titles, character names, static objects (spaceship, castle, treasure), and generic internet slang - those belong in Viral Culture. Prioritize words that work well for abstract-to-direct GIF hint progression.'
          : category === 'Gaming Moments'
            ? 'Include a balanced mix of the following: (1) ACTION GERUNDS from gaming (like "LEVELING", "FIGHTING", "SNEAKING", "DEFEATING", "EXPLORING", "RESPAWNING"), (2) EMOTION ADJECTIVES gamers feel (like "FRUSTRATED", "EXCITED", "VICTORIOUS", "FOCUSED", "SHOCKED", "TRIUMPHANT"), (3) DYNAMIC GAME STATES (like "POWERED", "STUNNED", "CRITICAL", "DEFEATED", "BOOSTED"), (4) ABSTRACT GAMING EXPERIENCES (like "VICTORY", "MISSION", "CHALLENGE", "CONQUEST", "TRIUMPH"). Focus on ACTIONS, EMOTIONS, and DYNAMIC STATES that can be shown abstractly through reactions or directly through gameplay moments. COMPLETELY AVOID: specific game titles, character names, static elements (health, potion, treasure), environments (dungeon, arena), and internet slang. Prioritize words that work well for abstract-to-direct GIF hint progression.'
            : category === 'Story Experiences'
              ? 'Include a balanced mix of the following: (1) EMOTION ADJECTIVES from literary moments (like "ENCHANTED", "TERRIFIED", "HEARTBROKEN", "CURIOUS", "BETRAYED", "MESMERIZED"), (2) ACTION GERUNDS in stories (like "DISCOVERING", "SEARCHING", "FLEEING", "CONFRONTING", "REVEALING", "TRANSFORMING"), (3) ABSTRACT LITERARY THEMES (like "MYSTERY", "ROMANCE", "ADVENTURE", "DESTINY", "TRAGEDY", "REDEMPTION"), (4) DYNAMIC CHARACTER STATES (like "CURSED", "HAUNTED", "ENLIGHTENED", "POSSESSED", "TRANSFORMED"). Focus on EMOTIONS, ACTIONS, and EXPERIENCES readers feel through books. COMPLETELY AVOID: specific book titles, author names, character names, static settings (castle, mansion, island), overly abstract literary devices (metaphor), and internet slang. Prioritize words that work well for abstract-to-direct GIF hint progression.'
              : category === 'Viral Vibes'
                ? 'Include a balanced mix of the following: (1) VIRAL EMOTION STATES (like "SHOOK", "SNATCHED", "PRESSED", "LIVING", "SERVING", "UNHINGED", "DELULU"), (2) INTERNET SLANG ADJECTIVES (like "BUSSIN", "ICONIC", "CRINGE", "AWKWARD", "SALTY", "CURSED", "BASED"), (3) VIRAL TRENDS and REACTIONS (like "RIZZ", "SIGMA", "SLAY", "GLAZING", "FLEXING"), (4) MEME EXPRESSIONS (like "NO CAP", "SUS", "MID", "GOATED", "RATIO"). Focus exclusively on INTERNET CULTURE, MEMES, and SOCIAL MEDIA terminology that describes states, emotions, and reactions. COMPLETELY AVOID: cinematic/dramatic terms (revenge, betrayal, destiny), gaming terms (quest, dungeon, warrior), or literary terms (mystery, tragedy) - those belong in other categories.'
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
        : `Generate ${count} DIVERSE phrases (each with a minimum of two words) that would yield EXCELLENT ANIMATED GIFs when searched on GIPHY related to ${category}. 
    ${category === 'Cinematic Feels'
          ? 'Include a balanced mix of the following: (1) ACTION-BASED MOVIE SCENARIOS (like "EPIC BATTLE", "CAR CHASE", "FINAL SHOWDOWN", "SLOW MOTION", "LOVE STORY"), (2) EMOTIONAL FILM MOMENTS (like "BIG REVEAL", "PLOT TWIST", "HERO MOMENT", "LAST STAND", "JUMP SCARE"), (3) CINEMATIC REACTIONS (like "MIND BLOWN", "SHOCK REVEAL", "SWEET REVENGE", "TRAGIC END"), (4) DYNAMIC STORYTELLING PHRASES (like "DREAM SEQUENCE", "TIME TRAVEL", "EVIL TWIN", "FINAL BATTLE"). Focus on ACTION VERB PHRASES and REACTION PHRASES that describe visual movie moments. COMPLETELY AVOID: direct movie titles, character names, and generic internet/meme phrases (mic drop, vibe check) - those belong in Viral Culture. Prioritize phrases with clear abstract-to-direct GIF progression.'
          : category === 'Gaming Moments'
            ? 'Include a balanced mix of the following: (1) CORE GAMING ACTION PHRASES (like "LEVEL UP", "BOSS FIGHT", "GAME OVER", "POWER UP", "FINAL FORM"), (2) PLAYER EMOTIONAL EXPERIENCES (like "RAGE QUIT", "EPIC WIN", "CLUTCH SAVE", "PERFECT RUN", "TOTAL WIPE"), (3) GAMEPLAY MOMENTS (like "COMBO HIT", "SPEED RUN", "SKILL SHOT", "TEAM KILL", "RESPAWN"), (4) GAMING SCENARIOS (like "BOSS RUSH", "LOOT DROP", "SECRET AREA", "FINAL BOSS", "SAVE POINT"). Focus on ACTION VERB PHRASES that describe dynamic gaming moments. COMPLETELY AVOID: game titles, character names, and generic internet/meme phrases (mic drop, face palm) - those belong in Viral Culture. Prioritize phrases with clear abstract-to-direct GIF progression.'
            : category === 'Story Experiences'
              ? 'Include a balanced mix of the following: (1) EMOTIONAL STORY MOMENTS (like "TRUE LOVE", "DARK SECRET", "PLOT TWIST", "BIG REVEAL", "TRAGIC END"), (2) ACTION-BASED LITERARY PHRASES (like "EPIC TALE", "HERO QUEST", "FINAL BATTLE", "TIME JUMP", "FLASHBACK"), (3) DRAMATIC STORYTELLING MOMENTS (like "LOST WORLD", "MAGIC SPELL", "FORBIDDEN LOVE", "EVIL CURSE", "CHOSEN ONE"), (4) NARRATIVE DYNAMICS (like "CLIFFHANGER", "ORIGIN STORY", "PROPHECY", "BETRAYAL", "REDEMPTION"). Focus on ACTION and EMOTION-DRIVEN phrases from literary narratives. COMPLETELY AVOID: book titles, author names, character names, and generic internet/meme phrases (mic drop, vibe check) - those belong in Viral Vibes. Prioritize phrases with clear abstract-to-direct GIF progression.'
              : category === 'Viral Vibes'
                ? 'Include a balanced mix of the following: (1) VIRAL ACTION PHRASES (like "MIC DROP", "SIDE EYE", "FACE PALM", "JAW DROP", "EYE ROLL", "CHEF KISS"), (2) TRENDING REACTION MOMENTS (like "VIBE CHECK", "GLOW UP", "SPILL TEA", "THROW SHADE", "ATE THAT", "LEFT HANGING"), (3) INTERNET CULTURE ACTIONS (like "TOUCH GRASS", "GO VIRAL", "EPIC FAIL", "RATIO TIME", "GET REKT"), (4) MEME EXPRESSIONS (like "MAIN CHARACTER", "HOT TAKE", "PLOT TWIST", "NO CAP", "FOR REAL"). Focus exclusively on ACTION-BASED INTERNET SLANG, REACTION PHRASES, and SOCIAL MEDIA expressions. COMPLETELY AVOID: cinematic storytelling phrases (unless they became memes), gaming-specific terms, or literary concepts - those belong in other categories.'
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

    const prompt = `For the word/phrase "${word}", generate four sets of HIGHLY EFFECTIVE GIPHY GIF search terms that create a CHALLENGING but FAIR visual puzzle, arranged from contextual to specific:

1. FIRST SET (Contextual/Situational - shown to player first):
   - Use terms that show WHEN or WHERE you'd experience "${word}"
   - For EMOTIONS: show scenarios/situations that trigger this feeling
   - For ACTIONS: show contexts where this action happens
   - For ABSTRACT CONCEPTS: show visual representations or related scenarios
   - Must produce visually clear, recognizable GIFs that hint at the concept
   - Example: For "EXCITED" → ["surprise party", "big news", "winning"]
   - Example: For "TERRIFIED" → ["horror movie", "dark hallway", "jump scare"]
   - Example: For "ESCAPING" → ["running away", "chase scene", "prison break"]
   - Example: For "DESTINY" → ["chosen one", "prophecy fulfilled", "fate decides"]
   - Example: For "BETRAYAL" → ["backstabbing friend", "trust broken", "double cross"]
   - (3 terms)

2. SECOND SET (Emotional/Reaction - clearer connection):
   - Terms showing the FEELING or REACTION associated with "${word}"
   - Should yield expressive face/body language GIFs
   - For abstract concepts: show how people REACT to or FEEL about this concept
   - Example: For "EXCITED" → ["screaming happy", "can't believe", "freaking out"]
   - Example: For "BETRAYED" → ["shocked face", "crying alone", "broken trust"]
   - Example: For "DESTINY" → ["meant to be", "it was fate", "written in stars"]
   - (3 terms)

3. THIRD SET (Action/Visual - more direct):
   - Specific ACTIONS or VISUAL REPRESENTATIONS of "${word}"
   - Should show what the word LOOKS like in motion
   - For abstract concepts: use movie/story references that embody the concept
   - Example: For "CELEBRATING" → ["dance party", "champagne pop", "victory dance"]
   - Example: For "SNEAKING" → ["tiptoeing", "looking around", "spy move"]
   - Example: For "DESTINY" → ["hero journey", "final battle", "inevitable moment"]
   - (3 terms)

4. FOURTH SET (Direct/Specific - most obvious):
   - The word/phrase itself and closest visual synonyms
   - Direct terms that clearly represent the concept
   - Example: For "HEARTBROKEN" → ["heartbroken", "heartbreak", "broken heart"]
   - Example: For "DESTINY" → ["destiny", "fate", "predetermined"]
   - (3 terms)

CRITICAL RULES FOR CHALLENGING BUT FAIR PUZZLES:
✅ FIRST SET should be solvable with thinking (not random guessing)
✅ Use COMPOUND TERMS (2-3 words) for better GIF matching ("surprise party" vs "party")
✅ For abstract concepts, use MOVIE/STORY SCENARIOS that embody the idea
✅ Each set should feel like a logical progression when revealed
✅ All terms must produce ANIMATED, expressive GIFs with clear emotion/action
✅ Avoid overly philosophical terms ("inevitable", "eternal", "transcendent")
✅ Think like a puzzle creator: "Can players deduce this from visual context?"

❌ AVOID first set being too disconnected (players feel frustrated)
❌ AVOID single abstract words that yield random philosophical GIFs
❌ AVOID terms that yield text-heavy or static GIFs
❌ AVOID overly vague concepts with no clear visual representation

Use timestamp ${timestamp} and seed ${randomSeed} for variety.

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
      case 'Cinematic Feels':
        return [
          'TERRIFIED',
          'ESCAPING',
          'HEARTBROKEN',
          'VICTORIOUS',
          'EXPLODING',
          'BETRAYED',
          'FIGHTING',
          'SHOCKED',
          'REDEMPTION',
          'CHASING',
        ];
      case 'Gaming Moments':
        return [
          'LEVELING',
          'DEFEATED',
          'VICTORIOUS',
          'SNEAKING',
          'FRUSTRATED',
          'CRITICAL',
          'EXPLORING',
          'POWERED',
          'TRIUMPH',
          'RESPAWNING',
        ];
      case 'Story Experiences':
        return [
          'ENCHANTED',
          'DISCOVERING',
          'TERRIFIED',
          'MYSTERY',
          'FLEEING',
          'CURSED',
          'HEARTBROKEN',
          'ADVENTURE',
          'HAUNTED',
          'SEARCHING',
        ];
      case 'Viral Vibes':
        return [
          'SHOOK',
          'CRINGE',
          'UNHINGED',
          'AWKWARD',
          'SNATCHED',
          'SALTY',
          'FLEXING',
          'ICONIC',
          'PRESSED',
          'SERVING',
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
      case 'Cinematic Feels':
        return [
          'PLOT TWIST',
          'EPIC BATTLE',
          'CAR CHASE',
          'BIG REVEAL',
          'SLOW MOTION',
          'HERO MOMENT',
          'JUMP SCARE',
          'FINAL SHOWDOWN',
          'LOVE STORY',
          'LAST STAND',
        ];
      case 'Gaming Moments':
        return [
          'LEVEL UP',
          'BOSS FIGHT',
          'GAME OVER',
          'RAGE QUIT',
          'EPIC WIN',
          'POWER UP',
          'CLUTCH SAVE',
          'FINAL FORM',
          'COMBO HIT',
          'SPEED RUN',
        ];
      case 'Story Experiences':
        return [
          'PLOT TWIST',
          'TRUE LOVE',
          'DARK SECRET',
          'EPIC TALE',
          'BIG REVEAL',
          'HERO QUEST',
          'FINAL BATTLE',
          'MAGIC SPELL',
          'TIME JUMP',
          'LOST WORLD',
        ];
      case 'Viral Vibes':
        return [
          'MIC DROP',
          'SIDE EYE',
          'FACE PALM',
          'JAW DROP',
          'GLOW UP',
          'VIBE CHECK',
          'SPILL TEA',
          'EPIC FAIL',
          'CHEF KISS',
          'ATE THAT',
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
 * @param gifDescriptions - Array of actual GIF content descriptions from GIPHY
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

GIF DESCRIPTIONS (from GIPHY API):
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
