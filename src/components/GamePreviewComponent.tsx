// GamePreviewComponent.tsx
import { Devvit, Context, useAsync, useState } from '@devvit/public-api';

export const GamePreviewComponent = (context: Context) => {
  const [previewData, setPreviewData] = useState<{ 
    maskedWord?: string, 
    gifs?: string[], 
    creatorUsername?: string 
  }>({});

  useAsync(async () => {
    if (!context.postId) return null;
    
    // Try to get game ID from post relationship
    const gameId = await context.redis.hGet(`post:${context.postId}`, 'gameId');
    if (!gameId) return null;

    // Get game data directly from game storage
    const gameData = await context.redis.hGetAll(`game:${gameId}`);
    if (gameData) {
      setPreviewData({
        maskedWord: gameData.maskedWord,
        gifs: JSON.parse(gameData.gifs || '[]'),
        creatorUsername: gameData.creatorUsername,
      });
    }
    return null;
  }, undefined);

  return (
    <vstack alignment="center middle" height="100%" width="100%">
      <>
        <text style="heading" size="medium">Can you solve this GIF Enigma?</text>
        <hstack gap="medium">
          {previewData.gifs?.slice(0, 2).map((gif, index) => (
            <image
              key={String(index)}
              url={gif}
              imageWidth={100}
              imageHeight={100}
              description={`GIF clue ${index + 1}`}
            />
          ))}
        </hstack>
        <text color="#FF4500" weight="bold">Tap to play!</text>
      </>
    </vstack>
  );
};