import { Context, RichTextBuilder } from '@devvit/public-api';

export async function proxyRequest(
  params: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
  },
  _context: Context
) {
  console.log(`Proxying request to ${params.url.replace(/key=([^&]+)/, 'key=API_KEY_HIDDEN')}`);

  try {
    const fetchOptions: RequestInit = {
      method: params.method || 'GET',
      headers: params.headers || {},
    };

    // Only add body for non-GET requests
    if (params.method !== 'GET' && params.body) {
      fetchOptions.body = JSON.stringify(params.body);
    }

    console.log(
      `Making ${fetchOptions.method} request to ${params.url.replace(/key=([^&]+)/, 'key=API_KEY_HIDDEN')}`
    );

    const response = await fetch(params.url, fetchOptions);

    console.log(`Proxy response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Proxy request failed: ${response.status} - ${errorText}`);
      throw new Error(`Request failed with status ${response.status}`);
    }

    const responseData = await response.json();
    console.log(
      `Proxy request succeeded, received data with keys: ${Object.keys(responseData).join(', ')}`
    );

    return responseData;
  } catch (error) {
    console.error('Error in proxy request:', error);
    throw error;
  }
}

// Save a created game to Redis and optionally post to the subreddit
export async function saveGame(
  params: {
    word: string;
    maskedWord: string;
    questionText: string;
    gifs: string[];
    // postToSubreddit?: boolean;
  },
  context: Context
) {
  try {
    const { word, maskedWord, questionText, gifs } = params;
    const { redis, reddit, userId } = context;

    // Generate a unique game ID
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Save the game data using Redis from context
    await redis.hSet(`game:${gameId}`, {
      word,
      maskedWord,
      questionText,
      gifs: JSON.stringify(gifs),
      createdAt: Date.now().toString(),
      creatorId: userId || 'anonymous',
    });

    // Add to active games sorted set with timestamp as score
    await redis.zAdd('activeGames', { score: Date.now(), member: gameId });

    // Post to the PlayGIFEnigma
    let postId = null;
    try {
      // Create post title
      const postTitle = `GIF Enigma Challenge: ${maskedWord}`;

      // Create rich text content using RichTextBuilder
      const richtext = new RichTextBuilder()
        .heading({ level: 1 }, (h) => h.rawText('Can you solve this GIF Enigma?'))
        .heading({ level: 2 }, (h) => h.rawText(`Challenge: ${questionText}`))
        .heading({ level: 2 }, (h) => h.rawText(`Word to guess: ${maskedWord}`))
        .paragraph((p) =>
          p.text({ text: 'This challenge contains 4 GIFs that hint at the solution.' })
        )
        .paragraph((p) => p.text({ text: `Game ID: ${gameId}` }))
        .paragraph((p) =>
          p.text({ text: 'Play the game by visiting our app or commenting with your guess below!' })
        );

      const post = await reddit.submitPost({
        subredditName: 'PlayGIFEnigma',
        title: postTitle,
        richtext: richtext,
      });

      if (post && post.id) {
        postId = post.id;

        // Store post ID with game data for reference
        await redis.hSet(`game:${gameId}`, { redditPostId: postId });

        // Add a comment with the GIFs for visibility
        const gifsCommentText = gifs
          .map((gif, index) => `**GIF ${index + 1}:** ${gif}`)
          .join('\n\n');

        await reddit.submitComment({
          id: postId,
          text: `## Game GIFs:\n\n${gifsCommentText}`,
        });
      }
    } catch (postError) {
      console.error('Error posting to subreddit:', postError);
    }

    return {
      success: true,
      gameId,
      postedToReddit: !!postId,
      redditPostId: postId,
    };
  } catch (error) {
    console.error('Error saving game:', error);
    return { success: false, error: String(error) };
  }
}

// Get recent games
export async function getRecentGames(params: { limit?: number }, context: Context) {
  try {
    const { limit = 5 } = params;

    // Get most recent game IDs (highest scores first)
    const gameMembers = await context.redis.zRange('activeGames', 0, -1, {
      by: 'score',
      reverse: true,
      limit: { offset: 0, count: limit },
    });

    const games = await Promise.all(
      gameMembers.map(async ({ member: gameId }) => {
        const gameData = await context.redis.hGetAll(`game:${gameId}`);
        if (gameData?.gifs) gameData.gifs = JSON.parse(gameData.gifs);
        return { id: gameId, ...gameData };
      })
    );

    return { success: true, games };
  } catch (error) {
    console.error('Error getting recent games:', error);
    return { success: false, error: String(error) };
  }
}

// Get a specific game by ID
export async function getGame(params: { gameId: string }, context: Context) {
  try {
    const { gameId } = params;
    const gameData = await context.redis.hGetAll(`game:${gameId}`);

    if (!gameData || Object.keys(gameData).length === 0)
      return { success: false, error: 'Game not found' };

    if (gameData.gifs) gameData.gifs = JSON.parse(gameData.gifs);

    return { success: true, game: { id: gameId, ...gameData } };
  } catch (error) {
    console.error('Error getting game:', error);
    return { success: false, error: String(error) };
  }
}

// Cache GIF search results
export async function cacheGifResults(params: { query: string; results: any[] }, context: Context) {
  try {
    const { query, results } = params;

    if (!query || !results || !Array.isArray(results)) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Cache the results for 24 hours
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + 86400); // 24 hours in seconds

    await context.redis.set(`gifSearch:${query.toLowerCase()}`, JSON.stringify(results), {
      expiration: expirationDate,
    });

    return { success: true };
  } catch (error) {
    console.error('Error caching GIF results:', error);
    return { success: false, error: String(error) };
  }
}

// Get cached GIF search results
export async function getCachedGifResults(params: { query: string }, context: Context) {
  try {
    const { query } = params;

    if (!query) {
      return { success: false, error: 'Invalid query' };
    }

    const cachedResults = await context.redis.get(`gifSearch:${query.toLowerCase()}`);

    if (!cachedResults) {
      return { success: false, cached: false };
    }

    return { success: true, cached: true, results: JSON.parse(cachedResults) };
  } catch (error) {
    console.error('Error getting cached GIF results:', error);
    return { success: false, error: String(error) };
  }
}
