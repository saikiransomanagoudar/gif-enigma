import { Devvit, Context, useWebView } from "@devvit/public-api";
import { BlocksToWebviewMessage, WebviewToBlockMessage } from "../game/shared.js";
import { Preview } from "./components/Preview.js"

Devvit.configure({
  redditAPI: true,
  media: true,
  kvStore: true,
  redis: true,
  http: true,
  realtime: true,
});

Devvit.addSettings([
  {
    name: "tenor-api-key",
    label: "Tenor API Key",
    type: "string",
    isSecret: true,
    scope: "app",
  },
]);

// Custom post component
Devvit.addCustomPostType({
  name: "GIF Enigma",
  height: "tall",
  render: (context) => {
    const { mount, postMessage } = useWebView<WebviewToBlockMessage, BlocksToWebviewMessage>({
      url: "index.html",
      onMessage: async (message, { postMessage }) => {
        console.log('Received message', message);
        
        switch (message.type) {
          case "INIT":
          case "webViewReady":
            // Send initial data to web view
            postMessage({
              type: "INIT_RESPONSE",
              payload: {
                postId: context.postId || "unknown",
              },
            });
            
            // Also send any other data your app needs
            postMessage({
              type: "initialData",
              data: { 
                username: "testUser", 
                currentCounter: 42 
              },
            });
            break;
            
          case "setCounter":
            console.log("New counter from web view:", message.data.newCounter);
            // Handle counter updates if needed
            break;
            
          default:
            console.error('Unknown message type', message);
            break;
        }
      },
      onUnmount: () => {
        console.log("Web view closed");
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
  label: "Create GIF Enigma Game",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    const post = await reddit.submitPost({
      title: "GIF Enigma Game",
      subredditName: subreddit.name,
      preview: <Preview />,
    });

    ui.showToast({ text: "Created GIF Enigma post!" });
    ui.navigateTo(post.url);
  },
});

export function getAppVersion(context: Context): string {
  return context.appVersion || "0.0.4.34";
}

export default Devvit;