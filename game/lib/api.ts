export async function getCurrentUser() {
  try {
    const response = await fetch('/api/user/current');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('getCurrentUser error:', error);
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

export async function getRandomGame(username: string, category?: string) {
  try {
    const response = await fetch('/api/game/random', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, category }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('getRandomGame error:', error);
    return { success: false, error: String(error) };
  }
}

export async function saveGame(gameData: any) {
  const response = await fetch('/api/game/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData),
  });
  const data = await response.json();
  return data;
}

export async function getGameState(userId: string, gameId: string) {
  const response = await fetch(
    `/api/game/state?userId=${encodeURIComponent(userId)}&gameId=${encodeURIComponent(gameId)}`
  );
  const data = await response.json();
  return data;
}

export async function saveGameState(userId: string, gameId: string, playerState: any) {
  const response = await fetch('/api/game/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, gameId, playerState }),
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
  const response = await fetch(
    `/api/game/completed?username=${encodeURIComponent(username)}&gameId=${encodeURIComponent(gameId)}`
  );
  const data = await response.json();
  return data;
}

export async function postCompletionComment(
  postId: string,
  score: number,
  guess: string,
  timeTaken: number
) {
  const response = await fetch('/api/game/completion-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, score, guess, timeTaken }),
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
    console.error('getGeminiRecommendations error:', error);
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
    console.error('getGeminiSynonyms error:', error);
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

export async function getCreatorBonusStats(username: string) {
  const response = await fetch(`/api/creator/bonus-stats?username=${encodeURIComponent(username)}`);
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

// Alias for CreatePage - accepts object with category, inputType, and count
export async function fetchPreGeneratedItems(params: {
  category: string;
  inputType: 'word' | 'phrase';
  count: number;
}) {
  try {
    console.log('[API] fetchPreGeneratedItems - Request params:', params);
    const response = await fetch('/api/game/pre-generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    console.log('[API] fetchPreGeneratedItems - Response status:', response.status);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('[API] fetchPreGeneratedItems - Response data:', data);
    return data;
  } catch (error) {
    console.error('[API] fetchPreGeneratedItems error:', error);
    return { success: false, error: String(error), items: [] };
  }
}

// Alias for CreatePage - fetches synonyms for a word
export async function fetchGeminiSynonyms(word: string) {
  return getGeminiSynonyms(word);
}

// Alias for CreatePage - batch search GIFs
export async function batchSearchGiphyGifs(queries: string[], limit: number = 16) {
  const response = await fetch('/api/giphy/search-multiple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries, limit }),
  });
  const data = await response.json();
  return data;
}

// Check if user can create more games (daily limit)
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

// Check if user has already posted a completion comment on a game
export async function checkUserComment(username: string, gameId: string) {
  const response = await fetch(
    `/api/game/check-comment?username=${encodeURIComponent(username)}&gameId=${encodeURIComponent(gameId)}`
  );
  const data = await response.json();
  return data;
}
