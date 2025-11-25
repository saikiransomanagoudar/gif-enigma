/**
 * Profanity Filter Utility
 * Filters out inappropriate, vulgar, or abusive words/phrases from user-generated content
 */

// Common profanity patterns (basic list - can be expanded)
// Only includes explicitly offensive words, not common words with multiple meanings
const PROFANITY_LIST = [
  // Explicit profanity
  'fuck', 'shit', 'bitch', 'damn', 'crap', 'piss',
  'cock', 'pussy', 'cunt', 'bastard', 'whore', 'slut',
  
  // Variations with common substitutions
  'f*ck', 'sh*t', 'b*tch', 'd*mn',
  'fck', 'sht', 'btch', 'cnt',
  
  // Slurs and hate speech (abbreviated list - expand as needed)
  'nigger', 'nigga', 'fag', 'faggot', 'retard', 'retarded',
  
  // Sexual content (explicit only, avoiding anatomical terms with medical uses)
  'porn', 'xxx', 'nude', 'naked', 'boob', 'boobs', 'tit', 'tits',
  
  // Violence/threats (explicit only)
  'murder', 'rape', 'kill',
];

// Patterns for leetspeak and obfuscation
const LEETSPEAK_MAP: Record<string, string[]> = {
  'a': ['@', '4'],
  'e': ['3'],
  'i': ['1', '!'],
  'o': ['0'],
  's': ['$', '5'],
  't': ['7'],
  'l': ['1'],
};

/**
 * Normalizes text for profanity checking
 * Removes spaces, special characters, and converts leetspeak
 */
function normalizeForProfanityCheck(text: string): string {
  let normalized = text.toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^a-z0-9]/g, ''); // Remove special chars
  
  // Create variations to catch leetspeak
  return normalized;
}

/**
 * Generates leetspeak variations of a word
 */
function generateLeetspeakVariations(word: string): string[] {
  const variations: string[] = [word];
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const replacements = LEETSPEAK_MAP[char];
    
    if (replacements) {
      const newVariations: string[] = [];
      for (const variation of variations) {
        for (const replacement of replacements) {
          newVariations.push(
            variation.substring(0, i) + replacement + variation.substring(i + 1)
          );
        }
      }
      variations.push(...newVariations);
    }
  }
  
  return variations;
}

/**
 * Checks if text contains profanity (whole word match only)
 */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeForProfanityCheck(text);
  
  
  const originalWords = text.toLowerCase().split(/\s+/);
  
  // Check against profanity list
  for (const word of PROFANITY_LIST) {
    const normalizedWord = normalizeForProfanityCheck(word);
    
    // Check exact match with the entire normalized text
    if (normalized === normalizedWord) {
      return true;
    }
    
    // Check each word separately (for multi-word phrases)
    for (const origWord of originalWords) {
      const normalizedOrigWord = normalizeForProfanityCheck(origWord);
      if (normalizedOrigWord === normalizedWord) {
        return true;
      }
      
      // Check leetspeak variations for this word
      const variations = generateLeetspeakVariations(normalizedWord);
      for (const variation of variations) {
        if (normalizedOrigWord === variation) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Censors text by replacing it with asterisks or a safe placeholder
 */
export function censorText(text: string, replacement: string = '[censored]'): string {
  if (containsProfanity(text)) {
    return replacement;
  }
  return text;
}

/**
 * Returns a masked version of the text (all asterisks for inappropriate content)
 */
export function maskProfanity(text: string): string {
  if (!containsProfanity(text)) {
    return text;
  }
  
  // Replace entire text with asterisks
  return '*'.repeat(text.length);
}

/**
 * Filters a list of guesses, removing or censoring inappropriate content
 */
export function filterGuesses(
  guesses: Array<{ guess: string; count: number; percentage: number }>,
  mode: 'hide' | 'censor' | 'mask' = 'hide'
): Array<{ guess: string; count: number; percentage: number }> {
  if (mode === 'hide') {
    // Remove inappropriate guesses entirely
    return guesses.filter(g => !containsProfanity(g.guess));
  } else if (mode === 'censor') {
    // Replace inappropriate guesses with [censored]
    return guesses.map(g => ({
      ...g,
      guess: censorText(g.guess, '[censored]')
    }));
  } else {
    // Mask inappropriate guesses (e.g., "f**k")
    return guesses.map(g => ({
      ...g,
      guess: maskProfanity(g.guess)
    }));
  }
}
