import React, { useState, useEffect } from 'react';
import { NavigationProps } from '../App';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';

interface GameData {
  id: string;
  word: string;
  maskedWord: string;
  questionText: string;
  gifs: string[];
}

export const GamePage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gifHintCount, setGifHintCount] = useState(1);
  const [revealedLetters, setRevealedLetters] = useState<Set<number>>(new Set());
  const [guess, setGuess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("useEffect triggered: Sending 'webViewReady' message");
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    console.log("useEffect triggered: Sending 'GET_RECENT_GAMES' message with limit: 1");
    window.parent.postMessage({ type: 'GET_RECENT_GAMES', data: { limit: 1 } }, '*');

    const handleMessage = (event: MessageEvent) => {
      console.log('Message event received:', event);
      console.log('Raw event data:', event.data);

      // Unwrap the message if it's wrapped in a devvit envelope.
      let actualMessage = event.data;
      if (actualMessage && actualMessage.type === 'devvit-message' && actualMessage.data?.message) {
        actualMessage = actualMessage.data.message;
        console.log('Unwrapped message:', actualMessage);
      } else {
        console.log('Message is not wrapped; using raw message:', actualMessage);
      }

      // Process the GET_RECENT_GAMES_RESULT message
      if (actualMessage && actualMessage.type === 'GET_RECENT_GAMES_RESULT') {
        console.log('GET_RECENT_GAMES_RESULT received:', actualMessage);
        setIsLoading(false);
        if (
          actualMessage.success &&
          actualMessage.result &&
          actualMessage.result.games &&
          actualMessage.result.games.length > 0
        ) {
          const latestGame = actualMessage.result.games[0];
          console.log('Latest game data extracted:', latestGame);
          if (
            latestGame.id &&
            latestGame.word &&
            latestGame.maskedWord &&
            latestGame.questionText &&
            Array.isArray(latestGame.gifs)
          ) {
            setGameData(latestGame);
            console.log('Game data state updated:', latestGame);
          } else {
            console.error('Game data is incomplete:', latestGame);
            setError('Game data is incomplete');
          }
        } else {
          console.error('No games available or error received:', actualMessage.error);
          setError(actualMessage.error || 'No games available');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('Message event listener added');

    // Cleanup the event listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
      console.log('Message event listener removed');
    };
  }, []);

  const answer = gameData ? gameData.word.toUpperCase() : '';

  const handleWordHint = () => {
    if (!answer) return;
    const indices = answer.split('').map((_, i) => i);
    const unrevealed = indices.filter((i) => answer[i] !== ' ' && !revealedLetters.has(i));
    if (unrevealed.length === 0) return;
    const newRevealed = new Set(revealedLetters);
    const revealCount = Math.min(2, unrevealed.length);
    for (let i = 0; i < revealCount; i++) {
      const randIndex = Math.floor(Math.random() * unrevealed.length);
      newRevealed.add(unrevealed[randIndex]);
      unrevealed.splice(randIndex, 1);
    }
    setRevealedLetters(newRevealed);
  };

  const handleGuess = () => {
    if (
      gameData &&
      guess.replace(/\s+/g, '').toUpperCase() === gameData.word.replace(/\s+/g, '').toUpperCase()
    ) {
      alert('Correct! You guessed the secret!');
    } else {
      alert('Incorrect guess. Try again!');
    }
  };

  const handleGifHint = () => {
    if (gameData && gifHintCount < gameData.gifs.length) {
      setGifHintCount(gifHintCount + 1);
    }
  };

  const renderGifArea = () => {
    if (!gameData) {
      return (
        <div className="flex h-56 items-center justify-center md:h-64 lg:h-72">
          <ComicText size={0.6} color="#fff">
            No GIFs available
          </ComicText>
        </div>
      );
    }
    const gifUrls = gameData.gifs;
    if (!gifUrls || gifUrls.length === 0) {
      return (
        <div className="flex h-56 items-center justify-center md:h-64 lg:h-72">
          <ComicText size={0.6} color="#fff">
            No GIFs available
          </ComicText>
        </div>
      );
    }

    return (
      <div className="relative grid h-56 w-full max-w-md grid-cols-2 grid-rows-2 gap-2 transition-all duration-500 ease-in-out md:h-64 lg:h-72">
        {(() => {
          if (gifHintCount === 1) {
            // 1) First GIF occupies entire 2×2 area
            return (
              <img
                src={gifUrls[0]}
                alt="GIF 1"
                className="col-span-2 row-span-2 h-full w-full rounded-xl object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/create-page/fallback.gif';
                }}
              />
            );
          } else if (gifHintCount === 2) {
            // 2) Two GIFs side by side
            return (
              <>
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-2 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-2 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
              </>
            );
          } else if (gifHintCount === 3) {
            // 3) "Y shape": top row = first two, bottom row = 3rd spanning both columns
            return (
              <>
                {/* Top row */}
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                {/* Bottom row: 3rd GIF spanning both columns with styling to match size of top GIFs */}
                <div className="col-span-2 row-span-1 flex items-center justify-center">
                  <div className="flex h-full w-1/2 items-center justify-center">
                    <img
                      src={gifUrls[2]}
                      alt="GIF 3"
                      className="h-full w-full rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/create-page/fallback.gif';
                      }}
                    />
                  </div>
                </div>
              </>
            );
          } else {
            // 4) Full 2×2: each GIF in its own cell (like Windows logo)
            return (
              <>
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[2]}
                  alt="GIF 3"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[3]}
                  alt="GIF 4"
                  className="col-span-1 row-span-1 h-full w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
              </>
            );
          }
        })()}
      </div>
    );
  };

  const renderAnswerBoxes = () => {
    if (!answer) return null;
    return (
      <div className="mt-5 flex flex-wrap justify-center gap-2 transition-all duration-500">
        {answer.split('').map((ch, idx) => {
          if (ch === ' ') return <div key={`space-${idx}`} className="w-4" />;
          const isRevealed = revealedLetters.has(idx);
          return (
            <div
              key={idx}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 transition-all duration-500"
            >
              <ComicText size={0.8} color="#2563EB">
                {isRevealed ? ch : ''}
              </ComicText>
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <ComicText size={0.6} color={colors.primary}>
          Loading game...
        </ComicText>
      );
    }
    if (error) {
      return (
        <ComicText size={0.6} color="red">
          {error}
        </ComicText>
      );
    }
    if (!gameData) {
      return (
        <ComicText size={0.6} color="#fff">
          No games available
        </ComicText>
      );
    }
    return renderGifArea();
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-5">
      {/* Header */}
      <header className="mb-5 flex w-full max-w-4xl items-center justify-between">
        <button
          onClick={() => onNavigate('landing')}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.6} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 md:pr-12 lg:pr-20">
          <ComicText size={1.2} color={colors.primary}>
            GIF Enigma
          </ComicText>
        </div>
      </header>

      {/* Question */}
      {!isLoading && !error && gameData && (
        <div className="mb-6 px-4 text-center">
          <ComicText size={0.9} color="#2563EB">
            Can you crack the GIF Enigma and uncover the secret{' '}
            {gameData.word.includes(' ') ? 'phrase' : 'word'}?
          </ComicText>
        </div>
      )}

      {/* GIF Content or Loading/Error */}
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        {renderContent()}
      </div>

      {/* Answer Boxes */}
      <div className="mt-5 w-full max-w-4xl">{renderAnswerBoxes()}</div>

      {/* GIF Hint Button */}
      <div className="mt-3">
        <button
          onClick={handleGifHint}
          disabled={!gameData || (gameData?.gifs && gifHintCount >= gameData.gifs.length)}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.6} color="white">
            GIF Hint
          </ComicText>
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="mt-4 flex w-full max-w-4xl items-center justify-center gap-4 rounded-full p-4 shadow-lg">
        <button
          onClick={handleWordHint}
          disabled={!gameData && !isLoading}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.6} color="white">
            Word Hint
          </ComicText>
        </button>
        <div className="relative">
          <input
            type="text"
            placeholder="TYPE YOUR GUESS"
            value={guess}
            onChange={(e) => setGuess(e.target.value.toUpperCase())}
            className="w-72 rounded-full border border-gray-300 px-4 py-2 text-center uppercase transition-all duration-200 focus:outline-none"
            style={{ backgroundColor: 'white' }}
          />
        </div>
        <button
          onClick={handleGuess}
          disabled={!gameData && !isLoading}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.6} color="white">
            GUESS
          </ComicText>
        </button>
      </div>
    </div>
  );
};

export default GamePage;
