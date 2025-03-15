import { Context } from '@devvit/public-api';
import { redditSearchEnhanced, GifResult } from './redditSearch';

interface RedditSearchParams {
  query: string;
  subreddits?: string[];
  limit?: number;
  sort?: string;
}

export async function redditSearchEnhancedRPC(params: RedditSearchParams, context: Context): Promise<GifResult[]> {
  try {
    const results = await redditSearchEnhanced(params, context);
    return results;
  } catch (error) {
    console.error('Error in redditSearchEnhancedRPC:', error);
    throw new Error('Failed to fetch GIFs from Reddit');
  }
}