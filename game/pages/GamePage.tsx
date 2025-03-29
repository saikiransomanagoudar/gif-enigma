import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComicText } from '../lib/fonts';
import { colors } from '../lib/styles';
import * as transitions from '../../src/utils/transitions';
import {
  GameData,
  ScoreData,
  LeaderboardEntry,
  GameFlowState,
  NavigationProps,
  Page,
} from '../lib/types';
import { createRoot } from 'react-dom/client';

interface GamePageProps extends NavigationProps {
  onNavigate: (page: Page) => void;
  gameId?: string;
}

export const GamePage: React.FC<GamePageProps> = ({ onNavigate, gameId: propGameId }) => {
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
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const gameIdRef = useRef(propGameId);
  gameIdRef.current = propGameId;
  // @ts-ignore
  const [gameKey, setGameKey] = useState(Date.now());
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [maskedWord, setMaskedWord] = useState<string>('');
  const [gifVisibility, setGifVisibility] = useState<boolean[]>([]);
  const [usedGifHints, setUsedGifHints] = useState<number>(0);
  // @ts-ignore
  const [usedLetterHints, setUsedLetterHints] = useState<number>(0);

  // game score
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [finalScore, setFinalScore] = useState<ScoreData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [playedGameIds, setPlayedGameIds] = useState<string[]>([]);
  // @ts-ignore
  const [isScoreSaving, setIsScoreSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  // @ts-ignore
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  // @ts-ignore
  const [gameId, setGameId] = useState<string | null>(propGameId || null);
  const [guessCount, setGuessCount] = useState(0);

  // transition refs
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const gifAreaRef = useRef<HTMLDivElement>(null);
  const answerBoxesContainerRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const hintButtonRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    // Detect dark mode
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';
  const answerBoxborders = isDarkMode ? '' : 'border border-black';

  // Set up initial game page load animations and event handlers
  useEffect(() => {
    console.log('GamePage mounted with propGameId:', propGameId);
    if (!propGameId) {
      console.error('Error: GamePage mounted without a gameId');
      return;
    }

    setIsInitialLoading(true);

    const animationTimeout = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsInitialLoading(false);
      });
    });

    setIsPageLoaded(true);
    animatePageElements();
    setGameStartTime(Date.now());

    console.log('Directly requesting game data for ID:', propGameId);
    window.parent.postMessage(
      {
        type: 'GET_GAME',
        data: { gameId: propGameId },
      },
      '*'
    );
    // Get user info if available
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');

    // Load previously played game IDs from localStorage
    loadPlayedGameIds();
    console.log('🏆 [DEBUG] Marking game completed for:', username);

    // Set up main message handler
    const handleMessage = (event: MessageEvent) => {
      console.log('Message event received:', event);
      console.log('Raw event data:', event.data);

      // Unwrap the message if it's wrapped in a devvit envelope
      let actualMessage = event.data;
      if (actualMessage && actualMessage.type === 'devvit-message' && actualMessage.data?.message) {
        actualMessage = actualMessage.data.message;
        console.log('Unwrapped message:', actualMessage);
      } else {
        console.log('Message is not wrapped; using raw message:', actualMessage);
      }

      if (actualMessage.type === 'GET_GAME_RESULT') {
        console.log('GET_GAME_RESULT received:', actualMessage);
        setIsLoading(false);

        if (actualMessage.success && actualMessage.game) {
          const loadedGameData = actualMessage.game;
          setGameData(loadedGameData);
          setGameFlowState('playing');
          setRevealedLetters(new Set());
          setGuess('');
          setGifHintCount(1);
          setIsCorrect(null);

          // If this is a new game, add it to played games
          addToPlayedGames(loadedGameData.id);
        } else {
          setError(actualMessage.error || 'Game could not be loaded');
        }
      }

      // Handle user data
      if (actualMessage.type === 'GET_CURRENT_USER_RESULT') {
        if (actualMessage.success && actualMessage.user?.username) {
          setUsername(actualMessage.user.username);
          console.log('✅ [DEBUG] Set username to:', actualMessage.user.username);
        } else {
          console.warn('⚠️ [DEBUG] No username found, using anonymous');
          setUsername('anonymous');
        }
      }

      if (username && gameData?.id) {
        window.parent.postMessage(
          {
            type: 'GET_GAME_STATE',
            data: {
              gameId: gameData.id,
              username,
            },
          },
          '*'
        );

        window.parent.postMessage(
          {
            type: 'HAS_USER_COMPLETED_GAME',
            data: {
              gameId: gameData.id,
              username,
            },
          },
          '*'
        );
      }

      // Handle initialization
      if (actualMessage.type === 'INIT_RESPONSE') {
        console.log('INIT_RESPONSE received:', actualMessage);

        if (gameIdRef.current) {
          console.log('Using gameId from props:', gameIdRef.current);
          setGameId(gameIdRef.current);
          window.parent.postMessage(
            { type: 'GET_GAME_ID', data: { gameId: gameIdRef.current } },
            '*'
          );
        } else if (actualMessage.data?.gameId) {
          // Only proceed if propGameId wasn't already set
          console.log('Using gameId from INIT_RESPONSE:', actualMessage.data.gameId);
          setGameId(actualMessage.data.gameId);
          window.parent.postMessage(
            { type: 'GET_GAME_ID', data: { gameId: actualMessage.data.gameId } },
            '*'
          );
        } else {
          requestRandomGame();
        }
      }

      // Handle random game result
      if (actualMessage.type === 'GET_RANDOM_GAME_RESULT') {
        console.log('GET_RANDOM_GAME_RESULT received:', actualMessage);
        setIsLoading(false);

        if (actualMessage.success && actualMessage.result && actualMessage.result.game) {
          const randomGameData = actualMessage.result.game;
          if (
            !randomGameData.gifs ||
            !Array.isArray(randomGameData.gifs) ||
            randomGameData.gifs.length === 0
          ) {
            console.log('Game has no valid GIFs, requesting another game');
            requestRandomGame();
            return;
          }
          setIsLoading(false);
          setGameData(randomGameData);
          setGameFlowState('playing');
          setGameId(randomGameData.id);
          setRevealedLetters(new Set());
          setGuess('');
          setGifHintCount(1);
          setIsCorrect(null);

          // Add to played games
          addToPlayedGames(randomGameData.id);
        } else {
          setIsLoading(false);
          setError(actualMessage.error || 'Failed to load a random game');
        }
      }

      // Handle game state loading
      if (actualMessage.type === 'GET_GAME_STATE_RESULT') {
        console.log('GET_GAME_STATE_RESULT received:', actualMessage);

        if (actualMessage.success && actualMessage.state?.playerState) {
          const playerState = actualMessage.state.playerState;

          // Restore game state
          if (typeof playerState.gifHintCount === 'number') {
            setGifHintCount(playerState.gifHintCount);
          }

          if (Array.isArray(playerState.revealedLetters)) {
            setRevealedLetters(new Set(playerState.revealedLetters));
          }

          if (playerState.guess) {
            setGuess(playerState.guess);
          }

          if (playerState.isCompleted) {
            setGameFlowState('completed');
            setGameCompleted(true);

            // Load leaderboard for completed game
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

      if (actualMessage.type === 'MARK_GAME_COMPLETED_RESULT') {
        console.log('MARK_GAME_COMPLETED_RESULT received:', actualMessage);

        if (actualMessage.success) {
          // Successfully marked as completed on the server
          setGameCompleted(true);

          // Additional actions after successful marking as completed
          console.log('Game marked as completed successfully');
        } else {
          console.error('Failed to mark game as completed:', actualMessage.error);
        }
      }

      // Handle score calculation
      if (actualMessage.type === 'CALCULATE_SCORE_RESULT') {
        console.log('CALCULATE_SCORE_RESULT received:', actualMessage);

        if (actualMessage.success && actualMessage.result) {
          const score = actualMessage.result;
          console.log('💾 [DEBUG] Saving score for username:', username);

          // Use the server-calculated score
          setFinalScore({
            username: username || 'anonymous',
            gameId: gameData?.id || '',
            score: score.score,
            gifPenalty: score.gifPenalty,
            wordPenalty: score.wordPenalty,
            timeTaken: score.timeTaken || Math.floor((Date.now() - gameStartTime) / 1000),
            timestamp: Date.now(),
          });

          // Save the score
          window.parent.postMessage(
            {
              type: 'SAVE_SCORE',
              data: {
                ...score,
                username: score.username || username || 'anonymous',
                gameId: gameId || gameData?.id || '',
                timestamp: Date.now(),
              },
            },
            '*'
          );
        }
      }

      // Handle score saving
      if (actualMessage.type === 'SAVE_SCORE_RESULT') {
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

      // Handle leaderboard data
      if (actualMessage.type === 'GET_GAME_LEADERBOARD_RESULT') {
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
      if (actualMessage.type === 'HAS_USER_COMPLETED_GAME_RESULT') {
        console.log('HAS_USER_COMPLETED_GAME_RESULT received:', actualMessage);

        if (actualMessage.success && actualMessage.completed) {
          // User has already completed this game
          setGameCompleted(true);
          setGameFlowState('completed');

          // You may want to show a message or redirect
          console.log('This game has already been completed by the user');

          // Optionally load the leaderboard
          window.parent.postMessage(
            {
              type: 'GET_GAME_LEADERBOARD',
              data: { gameId: gameData?.id, limit: 10 },
            },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('Message event listener added');

    // Cleanup the event listener on unmount
    return () => {
      cancelAnimationFrame(animationTimeout);
      window.removeEventListener('message', handleMessage);
      console.log('Message event listener removed');
    };
  }, [propGameId]);

  // Save game state when it changes
  // Replace or update your existing game state saving useEffect
  useEffect(() => {
    // Only save state if we have both game data and username
    if (gameData && username) {
      // Convert Set to Array for storage
      const revealedLettersArray = Array.from(revealedLetters);

      // Create state object that matches our backend structure
      const playerState = {
        gifHintCount,
        revealedLetters: revealedLettersArray,
        guess: gameFlowState === 'won' || gameFlowState === 'completed' ? gameData.word : guess,
        lastPlayed: Date.now(),
        isCompleted: gameFlowState === 'won' || gameFlowState === 'completed',
      };

      // Send save state message
      window.parent.postMessage(
        {
          type: 'SAVE_GAME_STATE',
          data: {
            username: username || 'anonymous',
            gameId: gameData.id,
            playerState,
          },
        },
        '*'
      );
    }
  }, [gameData, username, gifHintCount, revealedLetters, guess, gameFlowState]);

  useEffect(() => {
    const handleMessage = (event: { data: any }) => {
      const message = event.data;

      if (message.type === 'GET_GAME_STATE_RESULT' && message.success) {
        if (message.state?.playerState) {
          const { playerState } = message.state;

          if (playerState.guess) setCurrentGuess(playerState.guess);

          if (typeof playerState.gifHintCount === 'number') {
            const newVisibility = Array(gameData?.gifs?.length || 4).fill(false);
            for (let i = 0; i < playerState.gifHintCount; i++) {
              if (i < newVisibility.length) newVisibility[i] = true;
            }
            setGifVisibility(newVisibility);
            setUsedGifHints(playerState.gifHintCount);
          }

          if (
            Array.isArray(playerState.revealedLetters) &&
            playerState.revealedLetters.length > 0
          ) {
            setRevealedLetters(playerState.revealedLetters);

            if (gameData?.word) {
              let newMaskedWord = gameData.maskedWord;
              if (typeof newMaskedWord === 'string') {
                const maskedArray = newMaskedWord.split('');
                playerState.revealedLetters.forEach((index: number) => {
                  if (index >= 0 && index < gameData.word.length) {
                    maskedArray[index] = gameData.word[index];
                  }
                });
                setMaskedWord(maskedArray.join(''));
              }
            }

            setUsedLetterHints(playerState.revealedLetters.length);
          }

          if (typeof playerState.isCompleted === 'boolean') {
            setGameCompleted(playerState.isCompleted);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameData]);

  useEffect(() => {
    if (!gameId || !username) return;

    const playerState = {
      gifHintCount: usedGifHints,
      revealedLetters: revealedLetters,
      guess: currentGuess,
      lastPlayed: Date.now(),
      isCompleted: gameCompleted,
    };

    const timeoutId = setTimeout(() => {
      window.parent.postMessage(
        {
          type: 'SAVE_GAME_STATE',
          data: { gameId, username, playerState },
        },
        '*'
      );
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [gameId, username, usedGifHints, revealedLetters, currentGuess, gameCompleted]);

  // @ts-ignore
  const unlockGifHint = useCallback(
    (index: number) => {
      if (!gameData || index < 0 || index >= gameData.gifs.length) return;

      const newVisibility = [...gifVisibility];
      newVisibility[index] = true;
      setGifVisibility(newVisibility);
      setUsedGifHints((prev) => prev + 1);
    },
    [gameData, gifVisibility]
  );

  // @ts-ignore
  const revealLetterHint = useCallback(() => {
    if (!gameData?.word) return;

    const unrevealedIndices = [];
    for (let i = 0; i < gameData.word.length; i++) {
      if (gameData.word[i] === ' ' || revealedLetters.has(i)) continue;
      unrevealedIndices.push(i);
    }

    if (unrevealedIndices.length === 0) return;

    const randomIndex = Math.floor(Math.random() * unrevealedIndices.length);
    const letterIndexToReveal = unrevealedIndices[randomIndex];

    setRevealedLetters((prev) => new Set(prev).add(letterIndexToReveal));

    const newMaskedWordArray = maskedWord.split('');
    newMaskedWordArray[letterIndexToReveal] = gameData.word[letterIndexToReveal];
    setMaskedWord(newMaskedWordArray.join(''));

    setUsedLetterHints((prev) => prev + 1);
  }, [gameData, maskedWord, revealedLetters]);

  useEffect(() => {
    if (isCorrect === true) {
      console.log('Correct answer detected! Showing celebration');
      handleCorrectGuess();
    }
    if (isCorrect === false) {
      console.log('Incorrect answer detected! Showing shake animation');
      handleIncorrectGuess();
    }
  }, [isCorrect]);

  // Helper functions
  const animatePageElements = () => {
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
  };

  const loadPlayedGameIds = () => {
    const savedGameIds = localStorage.getItem('playedGameIds');
    if (savedGameIds) {
      try {
        setPlayedGameIds(JSON.parse(savedGameIds));
      } catch (e) {
        console.error('Error parsing playedGameIds from localStorage:', e);
        localStorage.removeItem('playedGameIds');
      }
    }
  };

  const addToPlayedGames = (newGameId: string) => {
    if (!newGameId) return;

    // Add to played games list and save to localStorage
    const updatedGameIds = [...playedGameIds, newGameId];
    setPlayedGameIds(updatedGameIds);

    try {
      localStorage.setItem('playedGameIds', JSON.stringify(updatedGameIds));
    } catch (e) {
      console.error('Error saving playedGameIds to localStorage:', e);
    }
  };

  // Add this to your GamePage component
  const requestRandomGame = () => {
    console.log('Requesting a random game with valid GIFs');
    setIsLoading(true);

    // Request a random game that the user hasn't completed
    window.parent.postMessage(
      {
        type: 'GET_RANDOM_GAME',
        data: {
          username: username || 'anonymous',
          preferUserCreated: true,
        },
      },
      '*'
    );
  };

  const handleCorrectGuess = () => {
    if (gameData) {
      const currentUsername = username || 'anonymous';
      console.log('🏆 [DEBUG] Marking game completed for:', currentUsername);

      setGameFlowState('won');

      // Calculate hints used for scoring
      const gifHintsUsed = gifHintCount > 1 ? gifHintCount - 1 : 0;
      const originalRevealedLettersSize = revealedLetters.size;

      // Determine if it's a word or phrase for correct hint type labeling
      const isPhrase = gameData.word.includes(' ');
      const hintTypeLabel = isPhrase ? 'Phrase' : 'Word';

      // 1. Save game state as completed
      const playerState = {
        gifHintCount,
        revealedLetters: Array.from(revealedLetters),
        guess: gameData.word,
        lastPlayed: Date.now(),
        isCompleted: true,
      };

      let wordHintsUsed = 0;

      if (originalRevealedLettersSize > 0) {
        const cleanWord = gameData.word.replace(/\s+/g, '');
        const wordLength = cleanWord.length;

        if (wordLength >= 5 && wordLength <= 7) {
          // For 5-7 letter words, each hint reveals 2 letters
          wordHintsUsed = Math.ceil(originalRevealedLettersSize / 2);
        } else if (wordLength >= 8 && wordLength <= 10) {
          // For 8-10 letter words, each hint reveals 2 letters
          wordHintsUsed = Math.ceil(originalRevealedLettersSize / 2);
        } else if (wordLength >= 11 && wordLength <= 15) {
          // For 11-15 letter words, each hint reveals 2 letters
          wordHintsUsed = Math.ceil(originalRevealedLettersSize / 2);
        } else if (wordLength >= 16) {
          // For 16+ letter words, each hint reveals 3 letters
          wordHintsUsed = Math.ceil(originalRevealedLettersSize / 3);
        }
      }

      window.parent.postMessage(
        {
          type: 'SAVE_GAME_STATE',
          data: {
            username: currentUsername,
            gameId: gameData.id,
            playerState,
          },
        },
        '*'
      );

      // 2. Mark as completed (this will update completed games list)
      window.parent.postMessage(
        {
          type: 'MARK_GAME_COMPLETED',
          data: {
            gameId: gameData.id,
            username: currentUsername,
            gifHintCount,
            revealedLetters: Array.from(revealedLetters),
            finalGuess: gameData.word,
            commentData: {
              numGuesses: guessCount,
              gifHints: gifHintsUsed,
              wordHints: wordHintsUsed,
              hintTypeLabel,
            },
          },
        },
        '*'
      );

      window.parent.postMessage(
        {
          type: 'REFRESH_POST_PREVIEW',
        },
        '*'
      );

      // Apply green background to answer boxes
      const boxes = document.querySelectorAll('.answer-box');
      boxes.forEach((box) => {
        (box as HTMLElement).style.backgroundColor = '#86efac'; // Light green
        (box as HTMLElement).style.transition = 'background-color 0.5s ease';
      });

      // Create confetti
      createConfetti();

      // Show success message
      setTimeout(() => {
        window.alert('Congratulations! You guessed the secret word!');
      }, 100);
    }
  };

  const handleIncorrectGuess = () => {
    // Create animated modal for incorrect guess
    showToastNotification();

    // Apply vibration animation to answer boxes with stronger effect
    const container = document.getElementById('answer-boxes-container');
    if (container) {
      // Remove previous animation classes
      container.classList.remove('animate-vibrate');

      // Force reflow to reset animation
      void container.offsetWidth;

      // Apply new animation with stronger effect
      container.style.animation = 'vibrate 0.6s cubic-bezier(.36,.07,.19,.97) both';

      // Try browser vibration API
      try {
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      } catch (e) {
        console.log('Vibration not supported');
      }

      // Clean up animation after it completes
      setTimeout(() => {
        container.style.animation = 'none';
      }, 600);
    }

    // Apply red background to answer boxes
    const boxes = document.querySelectorAll('.answer-box');
    boxes.forEach((box, index) => {
      setTimeout(() => {
        // Flash effect
        (box as HTMLElement).style.backgroundColor = '#f87171'; // Brighter red
        (box as HTMLElement).style.transform = 'scale(1.1)';
        (box as HTMLElement).style.transition = 'all 0.2s cubic-bezier(.36,.07,.19,.97)';

        // Fade to lighter red
        setTimeout(() => {
          (box as HTMLElement).style.backgroundColor = '#fecaca'; // Light red
          (box as HTMLElement).style.transform = 'scale(1)';
          (box as HTMLElement).style.transition = 'all 0.3s ease';
        }, 200);
      }, index * 30); // Staggered timing for wave effect
    });
  };

  const createConfetti = () => {
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

    // Clean up
    setTimeout(() => {
      if (document.body.contains(confettiContainer)) {
        // Fade out
        confettiContainer.style.opacity = '0';
        confettiContainer.style.transition = 'opacity 1s ease';

        // Then remove
        setTimeout(() => {
          if (document.body.contains(confettiContainer)) {
            document.body.removeChild(confettiContainer);
          }
        }, 1000);
      }
    }, 8000);
  };

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

  const handleGuess = () => {
    console.log('handleGuess called');

    setGuessCount((prevCount) => prevCount + 1);

    if (!gameData || !gameData.word) {
      console.log('No game data available');
      return;
    }

    const cleanedGuess = guess.replace(/\s+/g, '').toUpperCase();
    const cleanedAnswer = gameData.word.replace(/\s+/g, '').toUpperCase();

    if (cleanedGuess === cleanedAnswer) {
      console.log('CORRECT ANSWER!');

      const originalRevealedCount = revealedLetters.size;
      setIsCorrect(true);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);

      // Just update game state to completed
      setGameFlowState('won');

      // No more client-side score calculation here
      // handleCorrectGuess will be called due to the gameFlowState change

      // Reveal all letters for UI
      const allIndices = new Set<number>();
      for (let i = 0; i < gameData.word.length; i++) {
        if (gameData.word[i] !== ' ') {
          allIndices.add(i);
        }
      }
      setRevealedLetters(allIndices);

      window.parent.postMessage(
        {
          type: 'CALCULATE_SCORE',
          data: {
            word: gameData.word,
            gifHintCount: gifHintCount,
            revealedLetterCount: originalRevealedCount, // Use captured count
            timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
            username: username || 'anonymous',
          },
        },
        '*'
      );
    } else {
      console.log('INCORRECT ANSWER!');
      setIsCorrect(false);

      // Show error popup
      setShowErrorPopup(true);
      setTimeout(() => setShowErrorPopup(false), 2000);
    }
  };

  const handleGifHint = () => {
    if (
      gameData &&
      gameData.gifs &&
      gameData.gifs.length > 1 &&
      gifHintCount < gameData.gifs.length
    ) {
      // Create variable to reference GIF container
      const gifContainer = document.querySelector('.gif-container');

      // Apply fadeOut transition to GIF area
      if (gifContainer) {
        // First fade out
        gifContainer.classList.add('opacity-0');
        (gifContainer as HTMLElement).style.transition = 'opacity 0.3s ease-out';

        // After fadeOut is complete, update state and fade back in
        setTimeout(() => {
          setGifHintCount((current) => current + 1);
          unlockGifHint(gifHintCount - 1);

          // After state update, fade back in
          setTimeout(() => {
            gifContainer.classList.remove('opacity-0');
          }, 50);
        }, 300);
      } else {
        // Fallback if container isn't found
        setGifHintCount((current) => current + 1);
      }
    }
  };

  const renderGifArea = () => {
    console.log('Game data:', gameData);
    console.log('GIF URLs:', gameData?.gifs);
    if (!gameData) {
      return (
        <div className="flex h-56 items-center justify-center md:h-64 lg:h-72">
          <ComicText size={0.6} color="#fff">
            No GIFs available, please create a game.
          </ComicText>
        </div>
      );
    }
    const gifUrls = gameData.gifs;
    if (!gifUrls || gifUrls.length === 0) {
      return (
        <div className="flex h-56 items-center justify-center md:h-64 lg:h-72">
          <ComicText size={0.6} color="#fff">
            No GIFs available, please create a game.
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
            displayChar = ch;
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
              className={`answer-box ${answerBoxborders} flex h-10 w-10 items-center justify-center rounded-lg ${bgColor} transition-all duration-500`}
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

  const showToastNotification = () => {
    // Create container
    const notificationContainer = document.createElement('div');
    notificationContainer.className =
      'fixed top-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-500 p-4 rounded-lg shadow-lg z-50 opacity-0 transition-all duration-300';
    document.body.appendChild(notificationContainer);

    // Create React root
    const root = createRoot(notificationContainer);

    // Render with React
    root.render(
      <div className="flex items-center gap-3">
        <span className="text-2xl">❌</span>
        <div>
          <ComicText size={0.8} color="white">
            Incorrect Guess
          </ComicText>
          <ComicText size={0.6} color="white">
            Try again!
          </ComicText>
        </div>
      </div>
    );

    // Show with animation
    setTimeout(() => {
      notificationContainer.classList.add('opacity-100');
      notificationContainer.classList.add('animate-vibrate');

      // Hide after delay
      setTimeout(() => {
        notificationContainer.classList.remove('opacity-100');
        notificationContainer.classList.add('opacity-0');

        // Remove from DOM
        setTimeout(() => {
          if (document.body.contains(notificationContainer)) {
            // Unmount React component
            root.unmount();

            // Remove container
            document.body.removeChild(notificationContainer);
          }
        }, 300);
      }, 2000);
    }, 100);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-56 flex-col items-center justify-center md:h-64 lg:h-72">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <ComicText size={0.6} color={colors.primary}>
            Loading game...
          </ComicText>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-56 flex-col items-center justify-center space-y-4 md:h-64 lg:h-72">
          <ComicText size={0.6} color="red">
            {error}
          </ComicText>
          <button
            onClick={() => onNavigate('landing')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-all hover:-translate-y-1 hover:bg-blue-700"
          >
            <ComicText size={0.6} color="white">
              Back to Home
            </ComicText>
          </button>
        </div>
      );
    }

    if (!gameData || !gameData.gifs || gameData.gifs.length === 0) {
      return (
        <div className="flex h-56 flex-col items-center justify-center space-y-4 p-4 text-center md:h-64 lg:h-72">
          <div className="text-4xl">🎮</div>
          <ComicText size={0.8} color="#fff">
            No games available right now!
          </ComicText>
          <ComicText size={0.6} color="#aaa">
            Why not create your own fun challenge?
          </ComicText>
          <button
            onClick={() => onNavigate('create')}
            className="mt-4 cursor-pointer rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-white shadow-lg transition-all hover:-translate-y-1 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center gap-2">
              <span>✨</span>
              <ComicText size={0.7} color="white">
                Create a Game
              </ComicText>
            </div>
          </button>
        </div>
      );
    }

    return renderGifArea();
  };

  const handleNewGame = () => {
    onNavigate('landing');
    // Option 2: Direct fetch of a new unplayed game
    // if (username) {
    //   window.parent.postMessage(
    //     {
    //       type: 'GET_RANDOM_GAME',
    //       data: {
    //         username: username || 'anonymous',
    //         preferUserCreated: true,
    //         // No need to specify excludeIds as the backend will handle this
    //       },
    //     },
    //     '*'
    //   );
    // }
  };

  if (gameFlowState === 'won') {
    return (
      <>
        {/* Backdrop overlay with blur */}
        <div className="bg-opacity-60 fixed inset-0 z-40 bg-black backdrop-blur-sm transition-all duration-500"></div>

        {/* Modal container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          {/* Floating celebration elements */}
          <div
            className="animate-float-up absolute h-8 w-8 rounded-full bg-yellow-400 opacity-30"
            style={{ left: '20%', top: '30%' }}
          ></div>
          <div
            className="animate-float-up absolute h-10 w-10 rounded-full bg-blue-500 opacity-30"
            style={{ left: '65%', top: '25%', animationDelay: '0.5s' }}
          ></div>
          <div
            className="animate-float-up absolute h-6 w-6 rounded-full bg-green-400 opacity-30"
            style={{ left: '80%', top: '60%', animationDelay: '1s' }}
          ></div>
          <div
            className="animate-float-up absolute h-8 w-8 rounded-full bg-red-500 opacity-30"
            style={{ left: '30%', top: '70%', animationDelay: '1.5s' }}
          ></div>
          <div
            className="animate-float-up absolute h-7 w-7 rounded-full bg-purple-500 opacity-30"
            style={{ left: '40%', top: '20%', animationDelay: '0.8s' }}
          ></div>

          {/* Modal card */}
          <div className="animate-modal-fade-in border-opacity-30 font-comic-sans relative w-full max-w-md overflow-hidden rounded-xl border-2 border-blue-600 bg-gradient-to-b from-gray-900 to-blue-900 shadow-2xl">
            {/* Header */}
            <div className="relative border-b border-blue-800 p-6 text-center">
              {/* Background glow - Changed to darker color that contrasts better with gold text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-opacity-70 h-36 w-36 rounded-full bg-blue-900 blur-xl"></div>
              </div>

              {/* Emoji */}
              <div className="mb-2 inline-block -rotate-3 transform">
                <div className="mb-1 text-5xl">🎉</div>
              </div>

              {/* Header text - Added text shadow and background for better visibility */}
              <div className="relative z-10">
                <div className="bg-opacity-50 inline-block rounded-lg bg-gray-900 px-4 py-2 shadow-lg">
                  <ComicText size={1.6} color="#FFD700">
                    Hurray!
                  </ComicText>
                </div>
                <div className="mt-2">
                  <ComicText size={1} color="#FF4500">
                    You guessed it right!
                  </ComicText>
                </div>
              </div>
            </div>
            {/* Content */}
            <div className="p-6 text-center">
              {/* Answer display */}
              <div className="bg-opacity-50 mb-6 rounded-lg border border-blue-700 bg-blue-900 p-4">
                <ComicText size={0.7} color="#fff">
                  The answer was:
                </ComicText>
                <div className="mt-2 rounded p-2 text-2xl font-bold text-white shadow-lg">
                  {gameData?.word.toUpperCase()}
                </div>
              </div>

              {/* Loading or buttons */}
              {isScoreSaving ? (
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <ComicText size={0.7} color="#fff">
                    Calculating your score...
                  </ComicText>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      onNavigate('leaderboard');
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-110 hover:shadow-lg"
                  >
                    <span>🏆</span>
                    <ComicText size={0.7} color="white">
                      View Results
                    </ComicText>
                  </button>

                  <button
                    onClick={handleBackClick}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-110 hover:shadow-lg"
                  >
                    <span>🏠</span>
                    <ComicText size={0.7} color="white">
                      Home
                    </ComicText>
                  </button>
                </div>
              )}

              {finalScore && !isScoreSaving && (
                <div className="mt-6 text-center">
                  <div className="bg-opacity-60 border-opacity-60 inline-block rounded-full border border-blue-500 bg-blue-900 px-6 py-2 shadow-lg">
                    <ComicText size={0.7} color="#FFFFFF">
                      Your Score: <span className="text-2xl text-cyan-300">{finalScore.score}</span>
                    </ComicText>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      key={gameKey}
      className={`${backgroundColor} flex min-h-screen flex-col items-center p-5 transition-opacity duration-500 select-none`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      {isInitialLoading && (
        <div className="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      )}
      <style>
        {`
        @keyframes confetti-fall {
          0% { 
            transform: translateY(-10px) rotate(0deg); 
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes float-up {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-80px); opacity: 0; }
        }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 5px rgba(79, 209, 97, 0.5); }
          50% { box-shadow: 0 0 25px rgba(79, 209, 97, 0.8); }
          100% { box-shadow: 0 0 5px rgba(79, 209, 97, 0.5); }
        }

        @keyframes vibrate {
        0% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        50% { transform: translateX(10px); }
        75% { transform: translateX(-10px); }
        100% { transform: translateX(0); }
      }

        .confetti {
          position: absolute;
          width: 10px;
          height: 20px;
          background-color: var(--confetti-color);
          opacity: 0.9;
          border-radius: 0 50% 50% 50%;
          animation: confetti-fall var(--fall-duration) linear forwards;
        }

        .celebration-text {
          position: absolute;
          font-size: 16px;
          font-weight: bold;
          color: gold;
          text-shadow: 0 0 5px rgba(0,0,0,0.7);
          animation: float-up 2s ease-out forwards;
          user-select: none;
          pointer-events: none;
        }

        .winner-modal {
          background: linear-gradient(135deg, #1a2a6c, #1a2a6c, #1a2a6c);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          position: relative;
          border: 2px solid rgba(255, 255, 255, 0.1);
          transform: scale(0.95);
          transition: all 0.3s ease;
        }

        .winner-modal::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('/confetti-bg.png');
          opacity: 0.1;
          z-index: 0;
          pointer-events: none;
        }

        .winner-modal:hover {
          transform: scale(1);
        }

        .winner-modal-header {
          background: linear-gradient(135deg, #4f36ec, #2563eb);
          padding: 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .winner-modal-header::after {
          content: '';
          position: absolute;
          height: 2px;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(90deg, transparent, #ffffff, transparent);
        }

        .score-card {
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(5px);
          border-radius: 10px;
          padding: 16px;
          margin: 16px 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .score-card:hover {
          background-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-3px);
        }

        .score-value {
          font-size: 42px;
          font-weight: bold;
          background: linear-gradient(90deg, #f5c339, #ffdd00);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
          margin: 10px 0;
        }

        .leaderboard-table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .leaderboard-table th {
          background-color: #2563eb;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 500;
        }

        .leaderboard-table tr:nth-child(even) {
          background-color: rgba(37, 99, 235, 0.05);
        }

        .leaderboard-table tr:nth-child(odd) {
          background-color: rgba(37, 99, 235, 0.02);
        }

        .leaderboard-table tr.current-user {
          background-color: rgba(255, 213, 79, 0.2);
          font-weight: 600;
        }

        .leaderboard-table tr:hover {
          background-color: rgba(37, 99, 235, 0.1);
        }

        .leaderboard-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(37, 99, 235, 0.1);
        }

        .top-3-label {
          display: inline-block;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
        }

        .top-1 {
          background-color: gold;
          color: #333;
        }

        .top-2 {
          background-color: silver;
          color: #333;
        }

        .top-3 {
          background-color: #cd7f32;
          color: white;
        }

        .action-button {
          padding: 12px 24px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .primary-button {
          background: linear-gradient(135deg, #4f36ec, #2563eb);
          color: white;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .primary-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 15px rgba(37, 99, 235, 0.4);
        }

        .secondary-button {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          backdrop-filter: blur(5px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .secondary-button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-3px);
        }

        .error-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #f44336, #d32f2f);
          color: white;
          padding: 16px 32px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(211, 47, 47, 0.3);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0;
          transition: all 0.3s ease;
        }

        .error-notification.show {
          opacity: 1;
          animation: vibrate 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }

        .animate-vibrate {
          animation: vibrate 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }

        .celebration-wrapper {
          position: fixed;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: 999;
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
          {/* <ComicText size={0.9} color="#2563EB">
            What {gameData.word.includes(' ') ? 'phrase' : 'word'} comes to your mind when you see
            this GIF?
          </ComicText> */}
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
            {gifHintCount === 1 && (gameData?.gifs?.length ?? 0) > 1
              ? // Initial state before any clicks
                'GIF Hint'
              : // After first click, show the counter
                `GIF Hint (${gifHintCount}/${gameData?.gifs?.length || 4})`}
          </ComicText>
        </button>
      </div>

      {gameData && gameData.category && (
        <div className="mt-1 flex items-center justify-center">
          <span className="mr-1">
            {gameData.category === 'Movies'
              ? '🎬'
              : gameData.category === 'Gaming'
                ? '🎮'
                : gameData.category === 'Books'
                  ? '📚'
                  : '🌐'}
          </span>
          <ComicText size={0.6} color={colors.textSecondary}>
            Category: <span style={{ fontWeight: 'bold' }}>{gameData.category}</span>
          </ComicText>
        </div>
      )}
      {/* Answer Boxes */}
      <div
        ref={answerBoxesContainerRef}
        className="mt-2 w-full max-w-4xl translate-y-4 transform opacity-0 transition-all duration-500"
      >
        {renderAnswerBoxes()}
      </div>
      {/* Bottom Bar */}
      <div
        ref={bottomBarRef}
        className="mt-4 flex w-full max-w-4xl translate-y-4 transform items-center justify-center gap-4 rounded-full p-4 opacity-0 shadow-lg transition-all duration-500 max-sm:flex-col"
      >
        <button
          onClick={handleWordHint}
          disabled={!gameData || isLoading}
          className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.6} color="white">
            {gameData?.word.includes(' ') ? 'Phrase' : 'Word'} Hint
          </ComicText>
        </button>
        <div className="mx-auto w-72">
          <div className="mx-auto w-72">
            <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1 shadow-lg transition-shadow duration-300 hover:shadow-2xl">
              <input
                type="text"
                placeholder="TYPE YOUR GUESS"
                value={guess}
                onChange={handleGuessChange}
                onKeyDown={handleKeyDown}
                className="w-full rounded-full bg-white px-6 py-3 text-center tracking-widest uppercase focus:ring-2 focus:ring-blue-400 focus:outline-none"
                style={{ fontFamily: '"Comic Sans MS", cursive, sans-serif' }}
              />
            </div>
          </div>
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
            GUESS IT!
          </ComicText>
        </button>
      </div>
      {showSuccessPopup && (
        <div className="success-popup show">
          <div className="popup-content">
            <ComicText size={1.2} color="#4CAF50">
              🎉 Congratulations! 🎉
            </ComicText>
            <ComicText size={0.8} color="white">
              You solved the GIF Enigma!
            </ComicText>
            <ComicText size={0.8} color="white">
              The answer was: <strong>{gameData?.word}</strong>
            </ComicText>
          </div>
        </div>
      )}
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
                    <tr key={index} className={entry.username === username ? 'bg-yellow-50' : ''}>
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
                    onNavigate('game');
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
