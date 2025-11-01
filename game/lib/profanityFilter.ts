/**
 * Profanity Filter Utility
 * Filters out inappropriate, vulgar, or abusive words/phrases from user-generated content
 */

// Common profanity patterns (basic list - can be expanded)
const PROFANITY_LIST = [
  // Explicit profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss',
  'cock', 'dick', 'pussy', 'cunt', 'bastard', 'whore', 'slut',
  
  // Variations with common substitutions
  'f*ck', 'sh*t', 'b*tch', 'a$$', 'd*mn', 'h*ll',
  'fck', 'sht', 'btch', 'dck', 'cnt',
  
  // Slurs and hate speech (abbreviated list - expand as needed)
  'nigger', 'nigga', 'fag', 'faggot', 'retard', 'retarded',
  
  // Sexual content
  'sex', 'porn', 'xxx', 'nude', 'naked', 'boob', 'tit', 'penis', 'vagina',
  
  // Violence/threats
  'kill', 'murder', 'rape', 'die', 'death', 'suicide',
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
 * Checks if text contains profanity
 */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeForProfanityCheck(text);
  
  // Check against profanity list
  for (const word of PROFANITY_LIST) {
    const normalizedWord = normalizeForProfanityCheck(word);
    
    // Check exact match
    if (normalized === normalizedWord || normalized.includes(normalizedWord)) {
      return true;
    }
    
    // Check leetspeak variations
    const variations = generateLeetspeakVariations(normalizedWord);
    for (const variation of variations) {
      if (normalized === variation || normalized.includes(variation)) {
        return true;
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
