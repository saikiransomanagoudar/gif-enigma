import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps } from '../App';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import * as transitions from '../../src/utils/transitions';

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
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const answerBoxesRef = useRef<HTMLDivElement>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const gifAreaRef = useRef<HTMLDivElement>(null);
  const answerBoxesContainerRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const hintButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPageLoaded(true);
    setTimeout(() => {
      if (headerRef.current) {
        transitions.animateElement(headerRef.current, {
          duration: 500,
          direction: 'up',
          distance: 'sm',
        });
      }
    }, 100);

    setTimeout(() => {
      if (questionRef.current) {
        transitions.animateElement(questionRef.current, {
          duration: 500,
          direction: 'up',
        });
      }
    }, 300);

    setTimeout(() => {
      if (gifAreaRef.current) {
        transitions.animateElement(gifAreaRef.current, {
          duration: 600,
          direction: 'up',
        });
      }
    }, 500);

    setTimeout(() => {
      if (answerBoxesContainerRef.current) {
        transitions.animateElement(answerBoxesContainerRef.current, {
          duration: 500,
          direction: 'up',
        });
      }
    }, 700);

    setTimeout(() => {
      if (hintButtonRef.current) {
        transitions.animateElement(hintButtonRef.current, {
          duration: 500,
          direction: 'up',
          delay: 800,
        });
      }
    }, 800);

    setTimeout(() => {
      if (bottomBarRef.current) {
        transitions.animateElement(bottomBarRef.current, {
          duration: 500,
          direction: 'up',
        });
      }
    }, 900);
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

  // Effect to handle animations and alerts based on answer correctness
  useEffect(() => {
    if (isCorrect === true) {
      console.log('Correct answer detected! Showing celebration');

      // Apply green background to answer boxes
      const boxes = document.querySelectorAll('.answer-box');
      boxes.forEach((box) => {
        (box as HTMLElement).style.backgroundColor = '#86efac'; // Light green
        (box as HTMLElement).style.transition = 'background-color 0.5s ease';
      });

      // Create confetti
      const confettiContainer = document.createElement('div');
      confettiContainer.style.position = 'fixed';
      confettiContainer.style.top = '0';
      confettiContainer.style.left = '0';
      confettiContainer.style.width = '100%';
      confettiContainer.style.height = '100%';
      confettiContainer.style.pointerEvents = 'none';
      confettiContainer.style.zIndex = '9999';
      document.body.appendChild(confettiContainer);

      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'][
          Math.floor(Math.random() * 5)
        ];
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.top = '-10px';

        // Set inline animation style
        confetti.style.animation = 'confetti-fall 4s linear forwards';
        confetti.style.animationDelay = `${Math.random() * 2}s`;

        confettiContainer.appendChild(confetti);
      }

      // Show success message
      setTimeout(() => {
        window.alert('Congratulations! You guessed the secret word!');
      }, 100);

      // Clean up
      setTimeout(() => {
        if (document.body.contains(confettiContainer)) {
          document.body.removeChild(confettiContainer);
        }
      }, 5000);
    }

    if (isCorrect === false) {
      console.log('Incorrect answer detected! Showing shake animation');

      // Apply shake animation directly to the container
      const container = document.getElementById('answer-boxes-container');
      if (container) {
        // Reset animation first to ensure it plays again if triggered multiple times
        container.style.animation = 'none';

        // Force reflow to make sure the animation restarts
        void container.offsetWidth;

        // Apply animation
        container.style.animation = 'shake 0.8s ease-in-out';

        // Apply red background to answer boxes
        const boxes = document.querySelectorAll('.answer-box');
        boxes.forEach((box) => {
          (box as HTMLElement).style.backgroundColor = '#fecaca'; // Light red
          (box as HTMLElement).style.transition = 'background-color 0.5s ease';
        });
      }

      // Show error message
      setTimeout(() => {
        window.alert('Incorrect guess. Try again!');
      }, 100);
    }
  }, [isCorrect]);

  const answer = gameData ? gameData.word.toUpperCase() : '';

  const handleBackClick = () => {
    // Fade out elements before navigating
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 300 });
    }

    if (questionRef.current) {
      transitions.fadeOut(questionRef.current, { duration: 300, delay: 50 });
    }

    if (gifAreaRef.current) {
      transitions.fadeOut(gifAreaRef.current, { duration: 300, delay: 100 });
    }

    if (answerBoxesContainerRef.current) {
      transitions.fadeOut(answerBoxesContainerRef.current, { duration: 300, delay: 150 });
    }

    if (bottomBarRef.current) {
      transitions.fadeOut(bottomBarRef.current, { duration: 300, delay: 200 });
    }

    // Navigate after animations complete
    setTimeout(() => {
      onNavigate('landing');
    }, 600);
  };

  const handleGuessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGuess = e.target.value.toUpperCase();
    setGuess(newGuess);

    console.log('Guess changed to:', newGuess);

    // Reset previous guess result states
    setIsCorrect(null);
    setIsShaking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && gameData && !isLoading && guess.length > 0) {
      console.log('Enter key pressed, triggering guess');
      handleGuess();
    }
  };

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

  // Simplified handleGuess function
  const handleGuess = () => {
    console.log('handleGuess called');

    if (!gameData || !gameData.word) {
      console.log('No game data available');
      return;
    }

    console.log('Current guess:', guess);
    console.log('Actual answer:', gameData.word);

    const cleanedGuess = guess.replace(/\s+/g, '').toUpperCase();
    const cleanedAnswer = gameData.word.replace(/\s+/g, '').toUpperCase();

    console.log('Cleaned guess:', cleanedGuess);
    console.log('Cleaned answer:', cleanedAnswer);

    if (cleanedGuess === cleanedAnswer) {
      console.log('CORRECT ANSWER!');

      // Reveal all letters
      const allIndices = new Set<number>();
      for (let i = 0; i < gameData.word.length; i++) {
        if (gameData.word[i] !== ' ') {
          allIndices.add(i);
        }
      }
      setRevealedLetters(allIndices);

      // Set as correct - this will trigger the useEffect for celebration
      setIsCorrect(true);
    } else {
      console.log('INCORRECT ANSWER!');
      // Set as incorrect - this will trigger the useEffect for shaking
      setIsCorrect(false);
      setIsShaking(true);

      // Reset shaking state after animation time
      setTimeout(() => {
        setIsShaking(false);
      }, 1000);
    }
  };

  const handleGifHint = () => {
    if (gameData && gifHintCount < gameData.gifs.length) {
      // Create variable to reference GIF container
      const gifContainer = document.querySelector('.gif-container');

      // Apply fadeOut transition to GIF area
      if (gifContainer) {
        // First fade out
        gifContainer.classList.add('opacity-0');
        (gifContainer as HTMLElement).style.transition = 'opacity 0.3s ease-out';

        // After fadeOut is complete, update state and fade back in
        setTimeout(() => {
          setGifHintCount(gifHintCount + 1);

          // After state update, fade back in
          setTimeout(() => {
            gifContainer.classList.remove('opacity-0');
          }, 50);
        }, 300);
      } else {
        // Fallback if container isn't found
        setGifHintCount(gifHintCount + 1);
      }
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
      <div className="gif-container relative grid h-56 w-full max-w-md grid-cols-2 grid-rows-2 gap-2 transition-all duration-500 ease-in-out md:h-64 lg:h-72">
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

    const guessChars = guess.replace(/\s+/g, '').toUpperCase().split('');

    // Log animation state
    console.log('Animation states:', { isShaking });

    return (
      <div
        ref={answerBoxesRef}
        id="answer-boxes-container"
        className={`mt-5 flex flex-wrap justify-center gap-2 transition-all duration-500 ${isShaking ? 'animate-shake' : ''}`}
        style={{ animation: isShaking ? 'shake 0.8s ease-in-out' : 'none' }}
      >
        {answer.split('').map((ch, idx) => {
          if (ch === ' ') return <div key={`space-${idx}`} className="w-4" />;

          const isRevealed = revealedLetters.has(idx);
          // Count non-space characters before this index to match with guess index
          const nonSpacesBefore = answer.substring(0, idx).replace(/\s+/g, '').length;
          const guessChar = guessChars[nonSpacesBefore];

          // Determine what to display in the box
          let displayChar = '';
          if (isRevealed) {
            displayChar = ch;
          } else if (guessChar && isCorrect === null) {
            displayChar = guessChar;
          } else if (isCorrect === true) {
            displayChar = ch; // Show correct letter if answer is right
          }

          // Determine box color
          let bgColor = 'bg-gray-200';
          if (isCorrect === true) {
            bgColor = 'bg-green-200';
          } else if (isCorrect === false && guessChar) {
            bgColor = 'bg-red-200';
          } else if (displayChar && isCorrect === null) {
            bgColor = 'bg-blue-100';
          }

          return (
            <div
              key={idx}
              className={`answer-box flex h-10 w-10 items-center justify-center rounded-lg ${bgColor} transition-all duration-500`}
            >
              <ComicText size={0.8} color="#2563EB">
                {displayChar}
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
    <div
      className="flex min-h-screen flex-col items-center p-5 transition-opacity duration-500"
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      <style>
        {`
        @keyframes shake {
          0% { transform: translateX(0); }
          10% { transform: translateX(-5px); }
          20% { transform: translateX(5px); }
          30% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          50% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          70% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
          90% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        
        @keyframes celebrate {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        @keyframes confetti-fall {
          0% { transform: translateY(-100px) rotate(0deg); }
          100% { transform: translateY(100vh) rotate(720deg); }
        }
        
        .animate-shake {
          animation: shake 0.8s ease-in-out;
        }
        
        .animate-celebrate {
          animation: celebrate 0.5s ease-in-out;
        }
        `}
      </style>

      {/* Header */}
      <header
        ref={headerRef}
        className="mb-5 flex w-full max-w-4xl translate-y-4 transform items-center justify-between opacity-0 transition-all duration-500"
      >
        <button
          onClick={handleBackClick}
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
        <div
          ref={questionRef}
          className="mb-6 translate-y-4 transform px-4 text-center opacity-0 transition-all duration-500"
        >
          <ComicText size={0.9} color="#2563EB">
            Can you crack the GIF Enigma and uncover the secret{' '}
            {gameData.word.includes(' ') ? 'phrase' : 'word'}?
          </ComicText>
        </div>
      )}

      {/* GIF Content or Loading/Error */}
      <div
        ref={gifAreaRef}
        className="flex w-full flex-1 translate-y-4 transform flex-col items-center justify-center opacity-0 transition-all duration-500"
      >
        {renderContent()}
      </div>

      {/* GIF Hint Button */}
      <div
        ref={hintButtonRef}
        className="mt-3 translate-y-4 transform opacity-0 transition-all duration-500"
      >
        <button
          onClick={handleGifHint}
          disabled={!gameData || (gameData?.gifs && gifHintCount >= gameData.gifs.length)}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.6} color="white">
            GIF Hint ({gifHintCount}/{gameData?.gifs?.length || 4})
          </ComicText>
        </button>
      </div>

      {/* Answer Boxes */}
      <div
        ref={answerBoxesContainerRef}
        className="mt-5 w-full max-w-4xl translate-y-4 transform opacity-0 transition-all duration-500"
      >
        {renderAnswerBoxes()}
      </div>

      {/* Bottom Bar */}
      <div
        ref={bottomBarRef}
        className="mt-4 flex w-full max-w-4xl translate-y-4 transform items-center justify-center gap-4 rounded-full p-4 opacity-0 shadow-lg transition-all duration-500"
      >
        <button
          onClick={handleWordHint}
          disabled={!gameData || isLoading}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
            onChange={handleGuessChange}
            onKeyDown={handleKeyDown}
            className="w-72 rounded-full border border-gray-300 px-4 py-2 text-center uppercase transition-all duration-200 focus:outline-none"
            style={{ backgroundColor: 'white' }}
          />
        </div>
        <button
          onClick={() => {
            console.log('Guess button clicked');
            handleGuess();
          }}
          disabled={!gameData || isLoading || guess.length === 0}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
