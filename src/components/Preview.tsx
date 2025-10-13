import { Devvit } from '@devvit/public-api';

export const Preview: Devvit.BlockComponent = () => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle" darkBackgroundColor="#0d1629" lightBackgroundColor="#E8E5DA" cornerRadius="medium">
        <image
          url="eyebrows.gif"
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
      </vstack>
    </zstack>
  );
};