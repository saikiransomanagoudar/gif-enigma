import { Devvit, Context, useWebView } from '@devvit/public-api';
import { BlocksToWebviewMessage, WebviewToBlockMessage } from '../game/shared.js';
import { Preview } from './components/Preview.js';

import {
  saveGameRPC,
  getRecentGamesRPC,
  getGameRPC,
  cacheGifResultsRPC,
  getCachedGifResultsRPC,
  proxyRequestRPC,
} from '../game/server/gameHandler.server.js';

import { redditSearchEnhancedRPC } from '../game/server/redditSearch.server.js';

Devvit.configure({
  redditAPI: true,
  media: true,
  kvStore: true,
  redis: true,
  http: true,
  realtime: true,
});

// Custom post component
Devvit.addCustomPostType({
  name: 'GIF Enigma',
  height: 'tall',
  render: (context) => {
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      url: 'index.html',
      onMessage: async (message, { postMessage }) => {
        console.log('Received message', message);

        if (message.type === 'RPC_CALL') {
          // Handle RPC calls
          try {
            const handlers = {
              saveGameRPC: (params: { word: string; maskedWord: string; questionText: string; gifs: string[]; postToSubreddit?: boolean; }) => saveGameRPC(params, context),
              getRecentGamesRPC: (params: { limit?: number; }) => getRecentGamesRPC(params, context),
              getGameRPC: (params: { gameId: string; }) => getGameRPC(params, context),
              cacheGifResultsRPC: (params: { query: string; results: any[]; }) => cacheGifResultsRPC(params, context),
              getCachedGifResultsRPC: (params: { query: string; }) => getCachedGifResultsRPC(params, context),
              redditSearchEnhancedRPC: (params: any) => redditSearchEnhancedRPC(params, context),
              proxyRequestRPC: (params: { url: string; method?: "GET" | "POST" | "PUT" | "DELETE"; headers?: Record<string, string>; body?: any; }) => proxyRequestRPC(params, context),
            };

            const handler = handlers[message.functionName as keyof typeof handlers];
            if (!handler) {
              throw new Error(`Unknown RPC function: ${message.functionName}`);
            }

            const result = await handler(message.params);

            postMessage({
              type: 'RPC_RESPONSE',
              id: message.id,
              result,
            });
          } catch (error) {
            postMessage({
              type: 'RPC_ERROR',
              id: message.id,
              error: String(error),
            });
          }
          return;
        }
        switch (message.type) {
          case 'INIT':
          case 'webViewReady':
            // Send initial data to web view
            postMessage({
              type: 'INIT_RESPONSE',
              payload: {
                postId: context.postId || 'unknown',
              },
            });

            // Also send any other data your app needs
            postMessage({
              type: 'initialData',
              data: {
                username: 'testUser',
                currentCounter: 42,
              },
            });
            break;

          case 'setCounter':
            console.log('New counter from web view:', message.data.newCounter);
            // Handle counter updates if needed
            break;

          default:
            console.error('Unknown message type', message);
            break;
        }
      },
      onUnmount: () => {
        console.log('Web view closed');
      },
    });

    return (
      <vstack height="100%" width="100%" alignment="center middle">
        <text style="heading">GIF Enigma Web View</text>
        <button onPress={mount}>Launch</button>
      </vstack>
    );
  },
});

Devvit.addMenuItem({
  label: 'Create GIF Enigma Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    const post = await reddit.submitPost({
      title: 'GIF Enigma Game',
      subredditName: subreddit.name,
      preview: <Preview />,
    });

    ui.showToast({ text: 'Created GIF Enigma post!' });
    ui.navigateTo(post.url);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || '0.0.4.34';
}

export default Devvit;
