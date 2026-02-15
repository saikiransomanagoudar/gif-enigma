export async function getCurrentUser() {
  try {
    const response = await fetch('/api/user/current');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error), username: null };
  }
}

export async function getUserStats(username: string) {
  const response = await fetch(`/api/user/stats?username=${encodeURIComponent(username)}`);
  const data = await response.json();
  return data;
}

export async function getTopScores() {
  const response = await fetch('/api/leaderboard/cumulative?limit=50');
  const data = await response.json();
  return data;
}

export async function getGame(gameId: string) {
  const response = await fetch(`/api/game/${encodeURIComponent(gameId)}`);
  const data = await response.json();
  return data;
}

export async function getRandomGame(
  username: string,
  options?: {
    excludeIds?: string[];
    preferUserCreated?: boolean;
    useStickyNavigation?: boolean;
  }
) {
  try {
    const response = await fetch('/api/game/random', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, ...options }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function saveGame(gameData: any) {
  try {
    const response = await fetch('/api/game/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function quickCreateGame(gameData: {
  word: string;
  category: string;
  inputType: string;
  synonyms: string[];
}) {
  try {
    const response = await fetch('/api/game/quick-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function manualCreateGame(gameData: {
  word: string;
  category: string;
  inputType: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
  gifDescriptions: string[];
  searchTerms: string[];
}) {
  try {
    const response = await fetch('/api/game/manual-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getGameState(username: string, gameId: string) {
  const response = await fetch(
    `/api/game/state?username=${encodeURIComponent(username)}&gameId=${encodeURIComponent(gameId)}`
  );
  const data = await response.json();
  return data;
}

export async function saveGameState(username: string, gameId: string, playerState: any) {
  const response = await fetch('/api/game/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, gameId, playerState }),
  });
  const data = await response.json();
  return data;
}

export async function validateGuess(username: string, gameId: string, guess: string) {
  const response = await fetch('/api/game/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, gameId, guess }),
  });
  const data = await response.json();
  return data;
}

export async function trackGuess(username: string, gameId: string, guess: string) {
  const response = await fetch('/api/game/track-guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, gameId, guess }),
  });
  const data = await response.json();
  return data;
}

export async function hasUserCompletedGame(username: string, gameId: string) {
  try {
    const response = await fetch(
      `/api/game/completed?username=${encodeURIComponent(username)}&gameId=${encodeURIComponent(gameId)}`
    );
    if (!response.ok) {
      return { success: false, error: 'Request failed' };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function postCompletionComment(
  gameId: string,
  username: string,
  numGuesses: number,
  gifHints: number,
  redditPostId?: string
) {
  const response = await fetch('/api/game/completion-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, username, numGuesses, gifHints, redditPostId }),
  });
  const data = await response.json();
  return data;
}

export async function searchGiphyGifs(query: string, limit: number = 16) {
  const response = await fetch('/api/giphy/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  const data = await response.json();
  return data;
}

export async function searchMultipleGiphyGifs(queries: string[], limit: number = 16) {
  const response = await fetch('/api/giphy/search-multiple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries, limit }),
  });
  const data = await response.json();
  return data;
}

export async function getGeminiRecommendations(
  category: string,
  inputType: 'word' | 'phrase',
  count: number = 10
) {
  try {
    const response = await fetch('/api/gemini/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, inputType, count }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error), recommendations: [] };
  }
}

export async function getGeminiSynonyms(word: string) {
  try {
    const response = await fetch('/api/gemini/synonyms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error), synonyms: [] };
  }
}

export async function saveScore(scoreData: any) {
  const response = await fetch('/api/score/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData),
  });
  const data = await response.json();
  return data;
}

export async function calculateScore(scoreData: any) {
  const response = await fetch('/api/score/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData),
  });
  const data = await response.json();
  return data;
}

export async function getGlobalLeaderboard(limit: number = 20) {
  const response = await fetch(`/api/leaderboard/global?limit=${limit}`);
  const data = await response.json();
  return data;
}

export async function getCumulativeLeaderboard(limit: number = 20) {
  const response = await fetch(`/api/leaderboard/cumulative?limit=${limit}`);
  const data = await response.json();
  return data;
}

export async function getGameStatistics(gameId: string) {
  const response = await fetch(`/api/game/statistics?gameId=${encodeURIComponent(gameId)}`);
  const data = await response.json();
  return data;
}

export async function getCreatorBonusStats(gameId: string) {
  const response = await fetch(`/api/creator/bonus-stats?gameId=${encodeURIComponent(gameId)}`);
  const data = await response.json();
  return data;
}

export async function getPreGeneratedItems(category: string, count: number = 20) {
  const response = await fetch('/api/game/pre-generated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, count }),
  });
  const data = await response.json();
  return data;
}

export async function fetchPreGeneratedItems(params: {
  category: string;
  inputType: 'word' | 'phrase';
  count: number;
}) {
  try {
    const response = await fetch('/api/game/pre-generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: String(error), items: [] };
  }
}

export async function fetchGeminiSynonyms(word: string) {
  return getGeminiSynonyms(word);
}

export async function batchSearchGiphyGifs(queries: string[], limit: number = 16) {
  const response = await fetch('/api/giphy/search-multiple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries, limit }),
  });
  const data = await response.json();
  return data;
}

export async function checkCreationLimit() {
  const response = await fetch('/api/game/check-limit', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  return data;
}

export async function markGameCompleted(data: {
  username: string;
  gameId: string;
  gifHintCount: number;
  revealedLetters: number[];
  finalGuess: string;
  hasGivenUp?: boolean;
  timeTaken: number;
}) {
  const response = await fetch('/api/game/mark-completed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const data_result = await response.json();
  return data_result;
}

export async function getGameLeaderboard(gameId: string, limit: number = 10) {
  const response = await fetch(
    `/api/leaderboard/game?gameId=${encodeURIComponent(gameId)}&limit=${limit}`
  );
  const data = await response.json();
  return data;
}

export async function checkUserComment(username: string, gameId: string) {
  const response = await fetch(
    `/api/game/check-comment?username=${encodeURIComponent(username)}&gameId=${encodeURIComponent(gameId)}`
  );
  const data = await response.json();
  return data;
}
