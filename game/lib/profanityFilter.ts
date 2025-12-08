const PROFANITY_LIST = [
  // Explicit profanity - whole words or clear phrases
  'fuck', 'fucker', 'fucking', 'fucked', 'fuckoff', 'motherfucker',
  'shit', 'bullshit', 'shitty', 'bitch', 'bitching', 
  'damn', 'goddamn', 'crap', 'piss', 'pissed',
  
  // Variations with common substitutions
  'f*ck', 'sh*t', 'b*tch', 'd*mn', 'fuk', 'fck', 'phuck', 'phuk',
  'sht', 'shyt', 'btch', 'cnt', 'cok', 'dik', 'azz',
  
  // Slurs and hate speech - these should ALWAYS be caught
  'nigger', 'nigga', 'nig', 'niglet', 'fag', 'faggot', 'retard', 'retarded',
  
  // Sexual phrases (specific combinations to avoid false positives)
  'porn', 'xxx', 'handjob', 'blowjob', 'cumshot', 'orgasm',
  'suckmy', 'suckmydick', 'suckmycock', 'fuckyou',
  
  // Explicit body parts in sexual context (be careful with medical terms)
  'pussy', 'cunt', 'whore', 'slut', 'asshole',
  'tit', 'tits', 'boob', 'boobs',
  
  // Violence/threats
  'murder', 'rape', 'kill',
];

// Words that are allowed even if they contain profanity substrings
const WHITELIST = [
  'peacock', 'cockroach', 'cockatoo', 'woodcock', 'gamecock', 'stopcock',
  'assassin', 'assault', 'classic', 'glass', 'bass', 'mass', 'class', 'pass',
  'suck', 'sucky', 'suckle', 'honeysuckle', 'sucker',
  'thick', 'chick', 'chicken', 'dickens', 'thicket',
  'sextet', 'sextant', 'sussex', 'essex', 'middlesex',
  'retina', 'discrete', 'secretary',
  // Gender/sexuality terms that are NOT slurs
  'sex', 'sexual', 'sexuality', 'sexy', 'sexist', 'bisexual', 'asexual', 'heterosexual', 'homosexual',
  'gay', 'lesbian', 'lgbt', 'lgbtq', 'lgbtqia', 'queer',
  // Common words
  'dick', 'dickens', 'moby dick', 'spotted dick',
  'cock', 'peacock', 'cockpit', 'cocktail',
  'ass', 'assassin', 'assist', 'bass', 'brass', 'class', 'glass', 'grass', 'mass', 'pass',
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
  
  // Convert common leetspeak substitutions back to letters
  normalized = normalized
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
  
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
 * Checks if text contains profanity (with whitelist protection)
 */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeForProfanityCheck(text);
  const originalLower = text.toLowerCase().trim();
  
  // Check whitelist first - if it's a whitelisted word, it's safe
  for (const safe of WHITELIST) {
    const normalizedSafe = normalizeForProfanityCheck(safe);
    if (normalized === normalizedSafe || originalLower === safe.toLowerCase()) {
      return false;
    }
  }
  
  // Split by spaces to check individual words
  const originalWords = text.toLowerCase().split(/\s+/);
  
  // Check against profanity list
  for (const word of PROFANITY_LIST) {
    const normalizedWord = normalizeForProfanityCheck(word);
    
    // Check if profanity appears as substring in the entire normalized text
    if (normalized.includes(normalizedWord)) {
      return true;
    }
    
    // Check each word separately (for multi-word phrases)
    for (const origWord of originalWords) {
      const normalizedOrigWord = normalizeForProfanityCheck(origWord);
      
      // Skip if this word is whitelisted
      const isWhitelisted = WHITELIST.some(safe => 
        normalizeForProfanityCheck(safe) === normalizedOrigWord
      );
      if (isWhitelisted) {
        continue;
      }
      
      // Check substring match within individual words
      if (normalizedOrigWord.includes(normalizedWord)) {
        return true;
      }
      
      // Check exact match
      if (normalizedOrigWord === normalizedWord) {
        return true;
      }
      
      // Check leetspeak variations for this word
      const variations = generateLeetspeakVariations(normalizedWord);
      for (const variation of variations) {
        if (normalizedOrigWord.includes(variation)) {
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
