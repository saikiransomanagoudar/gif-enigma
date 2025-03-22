import { Devvit } from '@devvit/public-api';

export const Preview: Devvit.BlockComponent<{ text?: string }> = () => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle">
        <image
          url="eyebrows.gif"
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
        <spacer size="small" />
      </vstack>
    </zstack>
  );
};