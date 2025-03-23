import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps } from '../App';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import * as transitions from '../../src/utils/transitions';
import {
  GameData,
  ScoreData,
  LeaderboardEntry,
  GameFlowState,
  PlayerGameState,
} from '../lib/types';

export const GamePage: React.FC<NavigationProps> = ({ onNavigate }) => {
  // game data
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gameFlowState, setGameFlowState] = useState<GameFlowState>('loading');
  const [gifHintCount, setGifHintCount] = useState(1);
  const [revealedLetters, setRevealedLetters] = useState<Set<number>>(new Set());
  const [guess, setGuess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const answerBoxesRef = useRef<HTMLDivElement>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [gameKey, setGameKey] = useState(Date.now());

  // game score
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [finalScore, setFinalScore] = useState<ScoreData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // @ts-ignore
  const [userId, setUserId] = useState<string | null>(null);
  // const [username, setUsername] = useState<string>('Anonymous');
  const [playedGameIds, setPlayedGameIds] = useState<string[]>([]);
  // @ts-ignore
  const [isScoreSaving, setIsScoreSaving] = useState(false);

  // transition refs
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
    setIsPageLoaded(true);
    setGameStartTime(Date.now());
    // Get user info if available
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');

    // Load previously played game IDs from localStorage
    const savedGameIds = localStorage.getItem('playedGameIds');
    if (savedGameIds) {
      try {
        setPlayedGameIds(JSON.parse(savedGameIds));
      } catch (e) {
        console.error('Error parsing playedGameIds from localStorage:', e);
        localStorage.removeItem('playedGameIds');
      }
    }

    console.log("useEffect triggered: Sending 'webViewReady' message");
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    console.log("useEffect triggered: Sending 'GET_RANDOM_GAME' message");
    window.parent.postMessage(
      {
        type: 'GET_RANDOM_GAME',
        data: { excludeIds: playedGameIds },
      },
      '*'
    );

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GET_CURRENT_USER_RESULT') {
        if (event.data.success && event.data.user) {
          setUserId(event.data.user.id);
        } else {
          setUserId('anonymous'); // Explicitly set anonymous
        }
      }
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

      if (actualMessage && actualMessage.type === 'GET_RANDOM_GAME_RESULT') {
        console.log('GET_RANDOM_GAME_RESULT received:', actualMessage);
        setIsLoading(false);
        setError(null);

        if (actualMessage.success && actualMessage.result?.game) {
          const gameData = actualMessage.result.game;
          setGameData(gameData);
          setGameFlowState('playing'); // Explicitly set state to playing
          setRevealedLetters(new Set()); // Reset revealed letters
          setGuess(''); // Clear previous guess
          setGifHintCount(1); // Reset GIF hints
          setIsCorrect(null);
          setTimeout(() => {
            setIsPageLoaded(false);
            setIsPageLoaded(true);
          }, 50);
        } else if (actualMessage.error === 'No games available') {
          // Create a fallback game on the client side
          console.log('No games available from server, creating client-side fallback');

          const fallbackGame = {
            id: 'local_fallback_' + Date.now(),
            word: 'WIZARD',
            maskedWord: 'W_Z_RD',
            questionText: 'Guess the magical person:',
            gifs: [
              'https://media.giphy.com/media/3o84sq21TxDH6PyYms/giphy.gif',
              'https://media.giphy.com/media/3o7TKUAOqDm2SXaROM/giphy.gif',
              'https://media.giphy.com/media/QuxqWk7m9ffxyfoa0a/giphy.gif',
              'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif',
            ],
            createdAt: Date.now().toString(),
            creatorId: 'system',
          };

          setGameData(fallbackGame);
          setGameFlowState('playing');
          setError(null);
        } else {
          // Handle other errors
          console.error('Error getting game:', actualMessage.error);
          setError(actualMessage.error || 'No games available');
        }
      }
      if (actualMessage && actualMessage.type === 'GET_GAME_STATE_RESULT') {
        console.log('GET_GAME_STATE_RESULT received:', actualMessage);

        if (actualMessage.success && actualMessage.state) {
          const state = actualMessage.state as PlayerGameState;

          // Restore game state
          if (state.gifHintCount) {
            setGifHintCount(state.gifHintCount);
          }

          if (state.revealedLetters && Array.isArray(state.revealedLetters)) {
            // Ensure all elements are numbers
            const numberArray = state.revealedLetters.map(Number);
            setRevealedLetters(new Set(numberArray));
          }

          if (state.guess) {
            setGuess(state.guess);
          }

          if (state.isCompleted) {
            setGameFlowState('completed');
            // Get leaderboard if game was completed
            window.parent.postMessage(
              {
                type: 'GET_GAME_LEADERBOARD',
                data: { gameId: gameData?.id, limit: 10 },
              },
              '*'
            );
          }
        }
      }

      // Add these handlers for score calculation and leaderboard
      if (actualMessage && actualMessage.type === 'CALCULATE_SCORE_RESULT') {
        console.log('CALCULATE_SCORE_RESULT received:', actualMessage);

        if (actualMessage.success && actualMessage.result) {
          const score = actualMessage.result;
          setFinalScore({
            score: score.score,
            gifPenalty: score.gifPenalty,
            wordPenalty: score.wordPenalty,
            timeTaken: score.timeTaken || Math.floor((Date.now() - gameStartTime) / 1000),
            userId: userId || 'anonymous',
            gameId: gameData?.id || '',
            timestamp: Date.now(),
          });

          // Save the score
          window.parent.postMessage(
            {
              type: 'SAVE_SCORE',
              data: {
                ...score,
                userId,
                gameId: gameData?.id,
                timestamp: Date.now(),
              },
            },
            '*'
          );
        }
      }

      if (actualMessage && actualMessage.type === 'SAVE_SCORE_RESULT') {
        console.log('SAVE_SCORE_RESULT received:', actualMessage);
        setIsScoreSaving(false);

        if (actualMessage.success) {
          console.log('Score saved successfully');

          // Get leaderboard
          window.parent.postMessage(
            {
              type: 'GET_GAME_LEADERBOARD',
              data: { gameId: gameData?.id, limit: 10 },
            },
            '*'
          );
        } else {
          console.error('Error saving score:', actualMessage.error);
        }
      }

      if (actualMessage && actualMessage.type === 'GET_GAME_LEADERBOARD_RESULT') {
        console.log('GET_GAME_LEADERBOARD_RESULT received:', actualMessage);

        if (
          actualMessage.success &&
          actualMessage.result &&
          Array.isArray(actualMessage.result.leaderboard)
        ) {
          setLeaderboard(actualMessage.result.leaderboard);
          setShowLeaderboard(true);
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

  useEffect(() => {
    // Only save if we have a game, user ID, and the game is not completed
    if (gameData && userId && gameFlowState === 'playing') {
      // Convert Set to Array for storage
      const revealedLettersArray = Array.from(revealedLetters);

      window.parent.postMessage(
        {
          type: 'SAVE_GAME_STATE',
          data: {
            userId: userId || 'anonymous',
            gameId: gameData.id,
            playerState: {
              gifHintCount,
              revealedLetters: revealedLettersArray,
              guess,
              lastPlayed: Date.now(),
              isCompleted: false,
            },
          },
        },
        '*'
      );
    }
  }, [gameData, userId, gifHintCount, revealedLetters, guess, gameFlowState]);

  // Effect to handle animations and alerts based on answer correctness
  useEffect(() => {
    if (isCorrect === true) {
      console.log('Correct answer detected! Showing celebration');

      if (gameData) {
        try {
          // Calculate score on server side
          setIsScoreSaving(true);
          window.parent.postMessage(
            {
              type: 'CALCULATE_SCORE',
              data: {
                word: gameData.word,
                gifHintCount,
                revealedLetterCount: revealedLetters.size,
                timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
              },
            },
            '*'
          );
        } catch (error) {
          console.error('Error calculating score:', error);
          setFinalScore({
            score: 0,
            gifPenalty: 0,
            wordPenalty: 0,
            timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
            userId: userId || 'anonymous',
            gameId: gameData?.id || '',
            timestamp: Date.now(),
          });

          window.parent.postMessage(
            {
              type: 'GET_GAME_LEADERBOARD',
              data: { gameId: gameData?.id, limit: 10 },
            },
            '*'
          );
        }

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

    const cleanWord = answer.replace(/\s+/g, '');
    const wordLength = cleanWord.length;

    let revealCount = 2; // Default for most cases
    let maxHints = 1;

    if (wordLength >= 5 && wordLength <= 7) {
      revealCount = 2;
      maxHints = 1;
    } else if (wordLength >= 8 && wordLength <= 10) {
      revealCount = 2;
      maxHints = 2;
    } else if (wordLength >= 11 && wordLength <= 15) {
      revealCount = 2;
      maxHints = 3;
    } else if (wordLength >= 16) {
      revealCount = 3;
      maxHints = 3;
    }

    // Count how many hints were already used (divide by revealCount to get hint count)
    const hintsUsedSoFar = Math.ceil(revealedLetters.size / revealCount);

    // Check if we've used all allowed hints
    if (hintsUsedSoFar >= maxHints) {
      // Optional: Show a message that no more hints are available
      window.alert(`No more letter hints available for this word length (${wordLength} letters).`);
      return;
    }

    // Reveal only the specified number of letters
    const newRevealed = new Set(revealedLetters);
    revealCount = Math.min(revealCount, unrevealed.length);

    for (let i = 0; i < revealCount; i++) {
      const randIndex = Math.floor(Math.random() * unrevealed.length);
      newRevealed.add(unrevealed[randIndex]);
      unrevealed.splice(randIndex, 1);
    }

    setRevealedLetters(newRevealed);
  };

  // Update your handleGuess function:
  const handleGuess = () => {
    console.log('handleGuess called');

    if (!gameData || !gameData.word) {
      console.log('No game data available');
      return;
    }

    const cleanedGuess = guess.replace(/\s+/g, '').toUpperCase();
    const cleanedAnswer = gameData.word.replace(/\s+/g, '').toUpperCase();

    if (cleanedGuess === cleanedAnswer) {
      console.log('CORRECT ANSWER!');

      // Update game state to completed
      setGameFlowState('won');

      // Reveal all letters
      const allIndices = new Set<number>();
      for (let i = 0; i < gameData.word.length; i++) {
        if (gameData.word[i] !== ' ') {
          allIndices.add(i);
        }
      }
      setRevealedLetters(allIndices);

      // Calculate score
      const timeTaken = Math.floor((Date.now() - gameStartTime) / 1000); // in seconds

      // Save final state (completed)
      window.parent.postMessage(
        {
          type: 'SAVE_GAME_STATE',
          data: {
            userId,
            gameId: gameData.id,
            playerState: {
              gifHintCount,
              revealedLetters: Array.from(allIndices),
              guess: gameData.word,
              lastPlayed: Date.now(),
              isCompleted: true,
            },
          },
        },
        '*'
      );

      // Calculate score on server side
      setIsScoreSaving(true);
      window.parent.postMessage(
        {
          type: 'CALCULATE_SCORE',
          data: {
            word: gameData.word,
            gifHintCount,
            revealedLetterCount: revealedLetters.size,
            timeTaken,
          },
        },
        '*'
      );
    } else {
      console.log('INCORRECT ANSWER!');
      // Set animate shaking
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

  const handleNewGame = () => {
    // 1. Force complete component reset using key
    setGameKey(Date.now());

    // 2. Clear all game-related states
    setGameData(null); // Essential for UI reset
    setIsLoading(true); // Show loading state
    setError(null);
    setGifHintCount(1); // Reset to first GIF
    setRevealedLetters(new Set()); // Clear revealed letters
    setGuess(''); // Empty guess input
    setFinalScore(null); // Clear previous score
    setShowLeaderboard(false); // Hide leaderboard
    setIsCorrect(null); // Reset validation state
    setGameFlowState('loading'); // Force loading flow

    // 3. Visual reset for animations
    setIsPageLoaded(false);
    setTimeout(() => setIsPageLoaded(true), 50); // Allows fade-in

    // 4. Update played games list
    const newExclusions = gameData?.id ? [...playedGameIds, gameData.id] : playedGameIds;
    setPlayedGameIds(newExclusions);
    localStorage.setItem('playedGameIds', JSON.stringify(newExclusions));

    // 5. Delay game fetch to ensure state reset completes
    setTimeout(() => {
      window.parent.postMessage(
        {
          type: 'GET_RANDOM_GAME',
          data: {
            excludeIds: newExclusions,
            preferUserCreated: true,
            // Add cache busting for edge cases
            cacheBust: Date.now(),
          },
        },
        '*'
      );
    }, 100); // 100ms delay ensures clean state
  };

  if (gameFlowState === 'won') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-5 transition-all duration-500 ease-in-out">
        <div className="mb-8 transform text-center transition-all duration-500 hover:scale-105">
          <ComicText size={1.2} color="#FF4500">
            {' '}
            You've already solved this enigma!
          </ComicText>
          <div className="mt-4 text-lg text-gray-400">
            <ComicText size={0.7} color="#fff">
              The answer was:{' '}
              <span className="font-bold text-blue-500">{gameData?.word.toUpperCase()}</span>
            </ComicText>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              window.parent.postMessage(
                {
                  type: 'GET_GAME_LEADERBOARD',
                  data: { gameId: gameData?.id, limit: 10 },
                },
                '*'
              );
            }}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-110 hover:shadow-lg"
          >
            <ComicText size={0.7} color="white">
              View Results
            </ComicText>
          </button>

          <button
            onClick={handleNewGame}
            className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-110 hover:shadow-lg"
          >
            <ComicText size={0.7} color="white">
              Play Another Game
            </ComicText>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      key={gameKey}
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

        @keyframes enter {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-entrance {
          animation: enter 0.5s ease-out forwards;
        }
        
        .animate-shake {
          animation: shake 0.8s ease-in-out;
        }
        
        .animate-celebrate {
          animation: celebrate 0.5s ease-in-out;
        }

        .fade-entering {
          opacity: 0;
          transform: translateY(20px);
        }
        .fade-entered {
          opacity: 1;
          transform: translateY(0);
          transition: all 0.5s ease-out;
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
      {showLeaderboard && (
        <div className="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-2xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-blue-600">🎉 You Won! 🎉</h2>

            {finalScore ? (
              // Only show score details if finalScore exists
              <div className="mb-4 rounded-lg bg-blue-50 p-4">
                <h3 className="mb-2 text-xl font-semibold text-blue-700">Your Score</h3>
                <p className="text-lg font-bold text-blue-800">{finalScore.score} / 100</p>

                <div className="mt-2 text-sm text-gray-600">
                  <p>
                    GIF Hints Used: {gifHintCount} (-{finalScore.gifPenalty} pts)
                  </p>
                  <p>
                    Letter Hints Used: {revealedLetters.size} (-{finalScore.wordPenalty} pts)
                  </p>
                  <p>
                    Time: {Math.floor(finalScore.timeTaken / 60)}m {finalScore.timeTaken % 60}s
                  </p>
                </div>
              </div>
            ) : (
              // Show a placeholder if score calculation failed
              <div className="mb-4 rounded-lg bg-blue-50 p-4">
                <h3 className="mb-2 text-xl font-semibold text-blue-700">Score Calculation</h3>
                <p className="text-sm text-gray-600">Score details are not available.</p>
              </div>
            )}

            <h3 className="mb-2 text-center text-xl font-semibold text-blue-700">Leaderboard</h3>

            <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Player</th>
                    <th className="p-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={index} className={entry.userId === userId ? 'bg-yellow-50' : ''}>
                      <td className="border-t p-2">{index + 1}</td>
                      <td className="border-t p-2">{entry.username}</td>
                      <td className="border-t p-2 text-right">{entry.score}</td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-gray-500">
                        No scores yet. You're the first!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleNewGame}
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-all hover:bg-blue-700"
              >
                Play New Game
              </button>
              <button
                onClick={() => {
                  setShowLeaderboard(false);
                  setTimeout(() => {
                    onNavigate('landing');
                  }, 300);
                }}
                className="cursor-pointer rounded-lg bg-gray-600 px-4 py-2 text-white transition-all hover:bg-gray-700"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
