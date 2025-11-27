import React, { useState, useEffect, useRef } from 'react';
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
import { calculateDifficulty, getDifficultyEmoji, getDifficultyColor } from '../utils/difficultyCalculator';

interface GamePageProps extends NavigationProps {
  onNavigate: (page: Page, params?: { gameId?: string }) => void;
  gameId?: string;
}

export const GamePage: React.FC<GamePageProps> = ({ onNavigate, gameId: propGameId }) => {
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
  const gameIdRef = useRef(propGameId);
  gameIdRef.current = propGameId;
  // @ts-ignore
  const [gameKey, setGameKey] = useState(Date.now());
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [finalScore, setFinalScore] = useState<ScoreData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [playedGameIds, setPlayedGameIds] = useState<string[]>([]);
  // @ts-ignore
  const [isScoreSaving, setIsScoreSaving] = useState(false);
  const [showSuccessPopup, _setShowSuccessPopup] = useState(false);
  // @ts-ignore
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  // @ts-ignore
  const [gameId, setGameId] = useState<string | null>(propGameId || null);
  const [guessCount, setGuessCount] = useState(0);
  const [isCommentPosting, setIsCommentPosting] = useState(false);
  const [isCommentPosted, setIsCommentPosted] = useState(false);
  const [winningGuess, setWinningGuess] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(true); // Set to true by default for debugging
  const lastSubmittedGuessRef = useRef<string>('');
  const [showIncorrectPopup, setShowIncorrectPopup] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const gifAreaRef = useRef<HTMLDivElement>(null);
  const answerBoxesContainerRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const hintButtonRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';
  const answerBoxborders = isDarkMode ? '' : 'border border-black';

  useEffect(() => {
    if (!propGameId) {
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
    window.parent.postMessage(
      {
        type: 'GET_GAME',
        data: { gameId: propGameId },
      },
      '*'
    );
    window.parent.postMessage({ type: 'GET_CURRENT_USER' }, '*');
    window.parent.postMessage({ type: 'GET_DEBUG_MODE' }, '*');
    loadPlayedGameIds();

    const handleMessage = (event: MessageEvent) => {
      let actualMessage = event.data;
      if (actualMessage && actualMessage.type === 'devvit-message' && actualMessage.data?.message) {
        actualMessage = actualMessage.data.message;
      }
      if (actualMessage.type === 'GET_GAME_RESULT') {
        setIsLoading(false);

        if (actualMessage.success && actualMessage.game) {
          const loadedGameData = actualMessage.game;
          setGameData(loadedGameData);
          setGameFlowState('playing');
          setIsCorrect(null);

          addToPlayedGames(loadedGameData.id);
        } else {
          setError(actualMessage.error || 'Game could not be loaded');
        }
      }

      if (actualMessage.type === 'GET_CURRENT_USER_RESULT') {
        if (actualMessage.success && actualMessage.user?.username) {
          setUsername(actualMessage.user.username);
        } else {
          setUsername('anonymous');
        }
      }

      if (actualMessage.type === 'INIT_RESPONSE') {
        if (gameIdRef.current) {
          setGameId(gameIdRef.current);
          window.parent.postMessage(
            { type: 'GET_GAME_ID', data: { gameId: gameIdRef.current } },
            '*'
          );
        } else if (actualMessage.data?.gameId) {
          setGameId(actualMessage.data.gameId);
          window.parent.postMessage(
            { type: 'GET_GAME_ID', data: { gameId: actualMessage.data.gameId } },
            '*'
          );
        } else {
          requestRandomGame();
        }
      }

      if (actualMessage.type === 'GET_RANDOM_GAME_RESULT') {
        setIsLoading(false);

        if (actualMessage.success && actualMessage.result && actualMessage.result.game) {
          const randomGameData = actualMessage.result.game;
          if (
            !randomGameData.gifs ||
            !Array.isArray(randomGameData.gifs) ||
            randomGameData.gifs.length === 0
          ) {
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

          addToPlayedGames(randomGameData.id);
        } else {
          setIsLoading(false);
          setError(actualMessage.error || 'Failed to load a random game');
        }
      }

      if (actualMessage.type === 'GET_GAME_STATE_RESULT') {
        if (actualMessage.success && actualMessage.state?.playerState) {
          const playerState = actualMessage.state.playerState;

          if (typeof playerState.gifHintCount === 'number') {
            const restoredGifHintCount = playerState.gifHintCount > 0 ? playerState.gifHintCount : 1;
            setGifHintCount(restoredGifHintCount);
          } else {
            setGifHintCount(1);
          }

          if (Array.isArray(playerState.revealedLetters) && playerState.revealedLetters.length > 0) {
            setRevealedLetters(new Set(playerState.revealedLetters));
          } else {
            setRevealedLetters(new Set());
          }

          if (playerState.guess) {
            setGuess(playerState.guess);
          }

          if (playerState.isCompleted) {
            setGameFlowState('completed');

            window.parent.postMessage(
              {
                type: 'GET_GAME_LEADERBOARD',
                data: { gameId: gameData?.id, limit: 10 },
              },
              '*'
            );
          }
        } else {
          setGifHintCount(1);
          setRevealedLetters(new Set());
          setGuess('');
        }
      }

      if (actualMessage.type === 'CALCULATE_SCORE_RESULT') {
        if (actualMessage.success && actualMessage.result) {
          const score = actualMessage.result;
          setFinalScore({
            username: username || 'anonymous',
            gameId: gameData?.id || '',
            score: score.score,
            gifPenalty: score.gifPenalty,
            wordPenalty: score.wordPenalty,
            timeTaken: score.timeTaken || Math.floor((Date.now() - gameStartTime) / 1000),
            timestamp: Date.now(),
          });

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

      if (actualMessage.type === 'SAVE_SCORE_RESULT') {
        setIsScoreSaving(false);

        if (actualMessage.success) {
          window.parent.postMessage(
            {
              type: 'GET_GAME_LEADERBOARD',
              data: { gameId: gameData?.id, limit: 10 },
            },
            '*'
          );
        }
      }

      if (actualMessage.type === 'GET_GAME_LEADERBOARD_RESULT') {
        if (
          actualMessage.success &&
          actualMessage.result &&
          Array.isArray(actualMessage.result.leaderboard)
        ) {
          setLeaderboard(actualMessage.result.leaderboard);
          setShowLeaderboard(true);
        }
      }
      if (actualMessage.type === 'POST_COMPLETION_COMMENT_RESULT') {
        if (debugMode) console.log('[GamePage] Received POST_COMPLETION_COMMENT_RESULT:', actualMessage);
        setIsCommentPosting(false);
        if (actualMessage.success) {
          if (debugMode) console.log('[GamePage] Comment posted successfully');
          setIsCommentPosted(true);
        } else {
          if (debugMode) console.error('[GamePage] Failed to post comment:', actualMessage.error);
          try {
            window.alert(actualMessage.error || 'Failed to post comment');
          } catch {}
        }
      }
      if (actualMessage.type === 'HAS_USER_COMPLETED_GAME_RESULT') {
        if (actualMessage.success && actualMessage.completed) {
          setGameFlowState('completed');
          window.parent.postMessage(
            {
              type: 'GET_GAME_LEADERBOARD',
              data: { gameId: gameData?.id, limit: 10 },
            },
            '*'
          );
        }
      }
      if (actualMessage.type === 'VALIDATE_GUESS_RESULT') {
        if (actualMessage.success) {
          if (actualMessage.isCorrect) {
            setWinningGuess(lastSubmittedGuessRef.current);
            setIsCorrect(true);
          } else {
            setIsCorrect(false);
          }
        } else {
          setIsCorrect(false);
        }
      }
      
      if (actualMessage.type === 'DEBUG_MODE_TOGGLED') {
        setDebugMode(actualMessage.enabled);
        console.log('[GamePage] Debug mode', actualMessage.enabled ? 'enabled' : 'disabled');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      cancelAnimationFrame(animationTimeout);
      window.removeEventListener('message', handleMessage);
    };
  }, [propGameId]);

  useEffect(() => {
    if (gameData?.id && username && username !== 'anonymous') {
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
  }, [gameData?.id, username]);

  useEffect(() => {
    if (gameData && username) {
      const revealedLettersArray = Array.from(revealedLetters);
      const playerState = {
        gifHintCount,
        revealedLetters: revealedLettersArray,
        guess: gameFlowState === 'won' || gameFlowState === 'completed' ? gameData.word : guess,
        lastPlayed: Date.now(),
        isCompleted: gameFlowState === 'won' || gameFlowState === 'completed',
        numGuesses: guessCount,
        // Preserve hasGivenUp flag if player gave up (gifHintCount === 999)
        hasGivenUp: gifHintCount === 999 ? true : undefined,
      };

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
  }, [gameData, username, gifHintCount, revealedLetters, guess, gameFlowState, guessCount]);

  useEffect(() => {
    if (isCorrect === true) {
      handleCorrectGuess();
    }
    if (isCorrect === false) {
      handleIncorrectGuess();
    }
  }, [isCorrect]);

  const animatePageElements = () => {
    setTimeout(() => {
      if (headerRef.current) {
        transitions.animateElement(headerRef.current, {
          duration: 300,
          direction: 'up',
          distance: 'sm',
        });
      }
    }, 50);

    setTimeout(() => {
      if (questionRef.current) {
        transitions.animateElement(questionRef.current, {
          duration: 300,
          direction: 'up',
        });
      }
    }, 150);

    setTimeout(() => {
      if (gifAreaRef.current) {
        transitions.animateElement(gifAreaRef.current, {
          duration: 350,
          direction: 'up',
        });
      }
    }, 250);

    setTimeout(() => {
      if (answerBoxesContainerRef.current) {
        transitions.animateElement(answerBoxesContainerRef.current, {
          duration: 300,
          direction: 'up',
        });
      }
    }, 350);

    setTimeout(() => {
      if (hintButtonRef.current) {
        transitions.animateElement(hintButtonRef.current, {
          duration: 300,
          direction: 'up',
        });
      }
    }, 450);

    setTimeout(() => {
      if (bottomBarRef.current) {
        transitions.animateElement(bottomBarRef.current, {
          duration: 300,
          direction: 'up',
        });
      }
    }, 550);
  };

  const loadPlayedGameIds = () => {
    const savedGameIds = localStorage.getItem('playedGameIds');
    if (savedGameIds) {
      try {
        setPlayedGameIds(JSON.parse(savedGameIds));
      } catch (e) {
        localStorage.removeItem('playedGameIds');
      }
    }
  };

  const addToPlayedGames = (newGameId: string) => {
    if (!newGameId) return;

    const updatedGameIds = [...playedGameIds, newGameId];
    setPlayedGameIds(updatedGameIds);

    try {
      localStorage.setItem('playedGameIds', JSON.stringify(updatedGameIds));
    } catch (e) {}
  };

  const requestRandomGame = () => {
    setIsLoading(true);
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
      const originalRevealedCount = revealedLetters.size;
      
      setGameFlowState('won');

      const allIndices = new Set<number>();
      for (let i = 0; i < gameData.word.length; i++) {
        if (gameData.word[i] !== ' ') {
          allIndices.add(i);
        }
      }
      
      setTimeout(() => {
        setRevealedLetters(allIndices);
      }, 100);

      const playerState = {
        gifHintCount,
        revealedLetters: Array.from(allIndices),
        guess: gameData.word,
        lastPlayed: Date.now(),
        isCompleted: true,
      };

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

      window.parent.postMessage(
        {
          type: 'MARK_GAME_COMPLETED',
          data: {
            gameId: gameData.id,
            username: currentUsername,
            gifHintCount,
            revealedLetters: Array.from(allIndices), // Use all revealed letters
            finalGuess: gameData.word,
          },
        },
        '*'
      );

      window.parent.postMessage(
        {
          type: 'CALCULATE_SCORE',
          data: {
            word: gameData.word,
            gifHintCount: gifHintCount,
            revealedLetterCount: originalRevealedCount, // Use original count before revealing all
            timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
            username: currentUsername,
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

      const boxes = document.querySelectorAll('.answer-box');
      boxes.forEach((box) => {
        (box as HTMLElement).style.backgroundColor = '#86efac';
        (box as HTMLElement).style.transition = 'background-color 0.5s ease';
      });
      
      createConfetti();

    }
  };

  const handleIncorrectGuess = () => {
    // Show incorrect popup
    setShowIncorrectPopup(true);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    // Animate letter boxes with shake and vanish effect
    const boxes = document.querySelectorAll('.answer-box');
    boxes.forEach((box, index) => {
      setTimeout(() => {
        const boxElement = box as HTMLElement;
        
        // Phase 1: Shake animation - disable transitions and force animation
        boxElement.style.transition = 'none'; // Disable CSS transitions
        boxElement.style.animation = 'none';
        boxElement.style.transform = 'none';
        void boxElement.offsetWidth; // Force reflow
        
        // Apply shake animation with !important via inline style
        boxElement.style.animation = 'shake-box 0.6s cubic-bezier(.36,.07,.19,.97) both';
        boxElement.style.animationFillMode = 'both';
        
        setTimeout(() => {
          // Phase 2: Letters vanish with fade and scale out
          const letterContent = boxElement.querySelector('div[style*="position: relative"]') as HTMLElement;
          if (letterContent && letterContent.textContent && letterContent.textContent.trim()) {
            letterContent.style.animation = 'letter-vanish 0.4s ease-out forwards';
          }
          
          // Phase 3: Box flash red
          boxElement.style.backgroundColor = '#fca5a5'; // red-300
          boxElement.style.transition = 'background-color 0.2s ease';
          
          setTimeout(() => {
            // Phase 4: Reset everything
            boxElement.style.backgroundColor = '';
            boxElement.style.animation = '';
            boxElement.style.transform = '';
            boxElement.style.transition = ''; // Restore transitions
            boxElement.style.animationFillMode = '';
            
            // Clear the letter content animation
            if (letterContent) {
              letterContent.style.animation = 'none';
            }
          }, 600);
        }, 600);
      }, index * 40); // Stagger animation across boxes
    });

    // Hide popup and clear guess after animation completes
    setTimeout(() => {
      setShowIncorrectPopup(false);
      setGuess('');
    }, 1500);
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

      confetti.style.animation = 'confetti-fall 4s linear forwards';
      confetti.style.animationDelay = `${Math.random() * 2}s`;

      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      if (document.body.contains(confettiContainer)) {
        confettiContainer.style.opacity = '0';
        confettiContainer.style.transition = 'opacity 1s ease';

        setTimeout(() => {
          if (document.body.contains(confettiContainer)) {
            document.body.removeChild(confettiContainer);
          }
        }, 1000);
      }
    }, 8000);
  };

  const handlePostComment = () => {
    if (debugMode) console.log('[GamePage] handlePostComment called - gameData:', gameData?.id, 'username:', username);
    if (!gameData) {
      if (debugMode) console.warn('[GamePage] Cannot post comment - no game data');
      return;
    }
    if (isCommentPosting || isCommentPosted) {
      if (debugMode) console.log('[GamePage] Comment already posting or posted');
      return;
    }
    
    // Don't allow commenting if user gave up (gifHintCount === 999)
    if (gifHintCount >= 999) {
      if (debugMode) console.warn('[GamePage] Cannot post comment - user gave up');
      return;
    }
    
    const currentUsername = username || 'anonymous';
    const gifHintsUsed = gifHintCount > 1 ? gifHintCount - 1 : 0;

    if (debugMode) console.log('[GamePage] Sending POST_COMPLETION_COMMENT - guesses:', guessCount, 'gifHints:', gifHintsUsed);
    setIsCommentPosting(true);
    window.parent.postMessage(
      {
        type: 'POST_COMPLETION_COMMENT',
        data: {
          gameId: gameData.id,
          username: currentUsername,
          numGuesses: guessCount,
          gifHints: gifHintsUsed,
        },
      },
      '*'
    );
  };

  const handleGiveUp = () => {
    if (!gameData) return;

    const currentUsername = username || 'anonymous';
    
    const allIndices = new Set<number>();
    for (let i = 0; i < gameData.word.length; i++) {
      if (gameData.word[i] !== ' ') {
        allIndices.add(i);
      }
    }
    setRevealedLetters(allIndices);
    setGuess(gameData.word.toUpperCase());
    setGifHintCount(999); // CRITICAL: Update gifHintCount state so useEffect saves correct value
    
    setGameFlowState('completed');
    setFinalScore({
      username: currentUsername,
      gameId: gameData.id,
      score: 0,
      gifPenalty: 100,
      wordPenalty: 0,
      timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
      timestamp: Date.now(),
    });

    // Send completion message - server will resolve username if it's 'anonymous'
    window.parent.postMessage(
      {
        type: 'MARK_GAME_COMPLETED',
        data: {
          username: currentUsername,
          gameId: gameData.id,
          gifHintCount: 999,
          revealedLetters: Array.from(allIndices),
          finalGuess: gameData.word,
          hasGivenUp: true,
          timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
          commentData: {
            numGuesses: guessCount,
            gifHints: 999,
            wordHints: 0,
            hintTypeLabel: 'gave up',
          },
        },
      },
      '*'
    );

    // Save a score of 0 with maximum penalties for revealed answers
    // This ensures the score is exactly 0 regardless of calculateScore logic
    window.parent.postMessage(
      {
        type: 'SAVE_SCORE',
        data: {
          score: 0,
          gifPenalty: 100,
          wordPenalty: 0,
          timeTaken: Math.floor((Date.now() - gameStartTime) / 1000),
          username: currentUsername,
          gameId: gameData.id,
          timestamp: Date.now(),
        },
      },
      '*'
    );


    window.parent.postMessage(
      {
        type: 'GET_GAME_LEADERBOARD',
        data: { gameId: gameData.id, limit: 10 },
      },
      '*'
    );

    window.parent.postMessage(
      {
        type: 'REFRESH_POST_PREVIEW',
      },
      '*'
    );
    
    // Navigate directly to Game Results page instead of showing modal
    onNavigate('gameResults', { gameId: gameData.id });
  };

  const answer = gameData ? gameData.word.toUpperCase() : '';

  const handleBackClick = () => {
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 200 });
    }

    if (questionRef.current) {
      transitions.fadeOut(questionRef.current, { duration: 200, delay: 30 });
    }

    if (gifAreaRef.current) {
      transitions.fadeOut(gifAreaRef.current, { duration: 200, delay: 60 });
    }

    if (answerBoxesContainerRef.current) {
      transitions.fadeOut(answerBoxesContainerRef.current, { duration: 200, delay: 90 });
    }

    if (bottomBarRef.current) {
      transitions.fadeOut(bottomBarRef.current, { duration: 200, delay: 120 });
    }

    setTimeout(() => {
      onNavigate('landing');
    }, 400);
  };

  const handleGuessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGuess = e.target.value.toUpperCase();
    setGuess(newGuess);

    setIsCorrect(null);
    setIsShaking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && gameData && !isLoading && guess.length > 0) {
      handleGuess();
    }
  };

  const getStrategicRevealOrder = (word: string, allIndices: number[]): number[] => {
    const vowels = 'AEIOU';
    const wordUpper = word.toUpperCase();
    
    // Categorize indices by strategic value
    const vowelIndices: number[] = [];
    const firstLastIndices: number[] = [];
    const middleIndices: number[] = [];
    
    allIndices.forEach(idx => {
      const char = wordUpper[idx];
      if (vowels.includes(char)) {
        vowelIndices.push(idx);
      } else {
        // Check if it's at word boundaries (first/last of each word in phrase)
        const words = word.split(' ');
        let currentPos = 0;
        let isWordBoundary = false;
        
        for (const w of words) {
          if (idx === currentPos || idx === currentPos + w.length - 1) {
            isWordBoundary = true;
            break;
          }
          currentPos += w.length + 1; // +1 for space
        }
        
        if (isWordBoundary) {
          firstLastIndices.push(idx);
        } else {
          middleIndices.push(idx);
        }
      }
    });
    
    // Use deterministic shuffle within each category for consistency
    const shuffleWithSeed = (arr: number[], seed: number) => {
      const seededRandom = (index: number) => {
        const x = Math.sin(seed + index) * 10000;
        return x - Math.floor(x);
      };
      
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(i) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    let seed = 0;
    for (let i = 0; i < word.length; i++) {
      seed = ((seed << 5) - seed) + word.charCodeAt(i);
      seed = seed & seed;
    }
    
    // Return strategic order: vowels → word boundaries → middle letters
    return [
      ...shuffleWithSeed(vowelIndices, seed),
      ...shuffleWithSeed(firstLastIndices, seed + 1),
      ...shuffleWithSeed(middleIndices, seed + 2)
    ];
  };

  const handleWordHint = () => {
    if (!answer || !gameData) return;

    const indices = answer.split('').map((_, i) => i);
    const nonSpaceIndices = indices.filter((i) => answer[i] !== ' ');
    const unrevealed = nonSpaceIndices.filter((i) => !revealedLetters.has(i));
    
    if (unrevealed.length === 0) return;
    
    const cleanWord = answer.replace(/\s+/g, '');
    const wordLength = cleanWord.length;

    let revealCount = 2;
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
    
    const hintsUsedSoFar = Math.ceil(revealedLetters.size / revealCount);
    if (hintsUsedSoFar >= maxHints) {
      window.alert(`No more letter hints available for this word length (${wordLength} letters).`);
      return;
    }

    // Use strategic reveal order instead of random
    const strategicOrder = getStrategicRevealOrder(gameData.word, nonSpaceIndices);
    const unrevealedInOrder = strategicOrder.filter((i) => !revealedLetters.has(i));
    const newRevealed = new Set(revealedLetters);
    const toReveal = Math.min(revealCount, unrevealedInOrder.length);
    
    for (let i = 0; i < toReveal; i++) {
      newRevealed.add(unrevealedInOrder[i]);
    }

    setRevealedLetters(newRevealed);
  };

  const handleGuess = () => {
    setGuessCount((prevCount) => prevCount + 1);

    if (!gameData || !gameData.word) {
      return;
    }

    const cleanedGuess = guess.replace(/\s+/g, '').toUpperCase();
    lastSubmittedGuessRef.current = cleanedGuess;

    // Track the guess attempt
    if (gameData.id && username) {
      window.parent.postMessage(
        {
          type: 'TRACK_GUESS',
          data: {
            gameId: gameData.id,
            username: username || 'anonymous',
            guess: cleanedGuess,
          },
        },
        '*'
      );
    }

    // Use server-side validation to check if guess is correct
    // This will handle exact matches AND semantically correct synonyms with same length
    window.parent.postMessage(
      {
        type: 'VALIDATE_GUESS',
        data: {
          gameId: gameData.id,
          guess: cleanedGuess,
        },
      },
      '*'
    );
  };

  const handleGifHint = () => {
    if (
      gameData &&
      gameData.gifs &&
      gameData.gifs.length > 1 &&
      gifHintCount < gameData.gifs.length
    ) {
      const gifContainer = document.querySelector('.gif-container');
      if (gifContainer) {
        gifContainer.classList.add('opacity-0');
        (gifContainer as HTMLElement).style.transition = 'opacity 0.3s ease-out';

        setTimeout(() => {
          setGifHintCount((current) => current + 1);

          setTimeout(() => {
            gifContainer.classList.remove('opacity-0');
          }, 50);
        }, 300);
      } else {
        setGifHintCount((current) => current + 1);
      }
    }
  };

  const renderGifArea = () => {
    if (!gameData || !gameData.gifs) return null;
    const gifUrls = gameData.gifs;

    return (
      <div className="gif-container relative grid h-56 w-full max-w-md grid-cols-2 grid-rows-2 gap-2 transition-all duration-500 ease-in-out md:h-64 lg:h-72">
        {(() => {
          if (gifHintCount === 1) {
            return (
              <img
                src={gifUrls[0]}
                alt="GIF 1"
                className="col-span-2 row-span-2 h-full w-full rounded-2xl object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/create-page/fallback.gif';
                }}
              />
            );
          } else if (gifHintCount === 2) {
            return (
              <>
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-2 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-2 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
              </>
            );
          } else if (gifHintCount === 3) {
            return (
              <>
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <div className="col-span-2 row-span-1 flex items-center justify-center">
                  <div className="flex h-full w-1/2 items-center justify-center">
                    <img
                      src={gifUrls[2]}
                      alt="GIF 3"
                      className="h-full w-full rounded-xl object-contain"
                      onError={(e) => {
                        e.currentTarget.src = '/create-page/fallback.gif';
                      }}
                    />
                  </div>
                </div>
              </>
            );
          } else {
            return (
              <>
                <img
                  src={gifUrls[0]}
                  alt="GIF 1"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[1]}
                  alt="GIF 2"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[2]}
                  alt="GIF 3"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/create-page/fallback.gif';
                  }}
                />
                <img
                  src={gifUrls[3]}
                  alt="GIF 4"
                  className="col-span-1 row-span-1 h-full w-full rounded-2xl object-contain"
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

    const words = answer.split(' ');
    const isSingleWord = words.length === 1;

    // Create a flat array of non-space characters with their original positions
    const answerCharsWithPositions: Array<{ char: string; originalIdx: number; nonSpaceIdx: number }> = [];
    let nonSpaceCounter = 0;
    for (let i = 0; i < answer.length; i++) {
      if (answer[i] !== ' ') {
        answerCharsWithPositions.push({
          char: answer[i],
          originalIdx: i,
          nonSpaceIdx: nonSpaceCounter++
        });
      }
    }

    // Get category icon for watermark
    const getCategoryIcon = () => {
      if (!gameData?.category) return '';
      switch (gameData.category) {
        case 'Cinematic Feels': return '🎬';
        case 'Gaming Moments': return '🎮';
        case 'Story Experiences': return '📚';
        default: return '🔥';
      }
    };
    const categoryIcon = getCategoryIcon();

    return (
      <div
        ref={answerBoxesRef}
        id="answer-boxes-container"
        className={`mt-5 flex flex-wrap justify-center items-center gap-2 transition-all duration-500 ${isShaking ? 'animate-shake' : ''}`}
        style={{ animation: isShaking ? 'shake 0.8s ease-in-out' : 'none' }}
      >
        {words.map((word, wordIdx) => {
          // Get start position of this word in the original answer
          const wordStartPos = words.slice(0, wordIdx).reduce((sum, w) => sum + w.length + 1, 0);
          const wordEndPos = wordStartPos + word.length;
          
          // Filter chars that belong to this word
          const wordChars = answerCharsWithPositions.filter(
            item => item.originalIdx >= wordStartPos && item.originalIdx < wordEndPos
          );

          return (
            <div 
              key={`word-${wordIdx}`} 
              className={`flex gap-2 items-center justify-center ${isSingleWord ? 'flex-wrap' : 'flex-wrap'}`}
            >
              {wordChars.map((item, letterIdx) => {
                const isRevealed = revealedLetters.has(item.originalIdx);
                const guessChar = guessChars[item.nonSpaceIdx];

                let displayChar = '';
                if (isRevealed) {
                  displayChar = item.char;
                } else if (guessChar && isCorrect === null) {
                  displayChar = guessChar;
                } else if (isCorrect === true) {
                  displayChar = item.char;
                }

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
                    key={`${wordIdx}-${letterIdx}`}
                    className={`answer-box ${answerBoxborders} relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${bgColor} transition-all duration-500 overflow-hidden`}
                  >
                    {/* Category icon watermark inside each box - only show when empty */}
                    {categoryIcon && !displayChar && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ 
                          opacity: 0.12,
                          fontSize: '24px',
                          userSelect: 'none',
                          zIndex: 0
                        }}
                      >
                        {categoryIcon}
                      </div>
                    )}
                    {/* Letter display on top of watermark */}
                    <div style={{ fontFamily: "Comic Sans MS, Comic Sans, cursive", color: "#2563EB", fontWeight: "bold", letterSpacing: "0.5px", position: 'relative', zIndex: 1 }}>
                      {displayChar}
                    </div>
                  </div>
                );
              })}
              {/* Add word separator - visible divider between words (only for multi-word phrases) */}
              {!isSingleWord && wordIdx < words.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <div className="h-8 w-0.5 bg-gray-400 rounded-full opacity-60"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleNewGame = () => {
    onNavigate('landing');
  };

  if (gameFlowState === 'won') {
    return (
      <>
        <div className="fixed inset-0 z-40 backdrop-blur-sm transition-all duration-500" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}></div>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 overflow-y-auto">
          <div className="animate-modal-fade-in border-opacity-30 font-comic-sans relative w-full max-w-md overflow-hidden rounded-xl border-2 border-blue-600 bg-gradient-to-b from-gray-900 to-blue-900 shadow-2xl my-auto">
            <div className="relative border-b border-blue-800 p-4 text-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-opacity-70 h-24 w-24 rounded-full bg-blue-900 blur-xl"></div>
              </div>

              <div className="mb-1 inline-block -rotate-3 transform">
                <div className="text-4xl">🎉</div>
              </div>

              <div className="relative z-10">
                <div className="inline-block">
                  <ComicText size={1.3} color="#FFD700">
                    Hurray!
                  </ComicText>
                </div>
                <div className="mt-1">
                  <ComicText size={0.8} color="#FF4500">
                    You guessed it right!
                  </ComicText>
                </div>
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="bg-opacity-50 mb-4 rounded-lg border border-blue-700 bg-blue-900 p-3">
                {(() => {
                  const secretWord = gameData?.word.toUpperCase().replace(/\s+/g, '');                  
                  if (winningGuess && winningGuess !== secretWord) {
                    return (
                      <>
                        <div className="mb-2">
                          <ComicText size={0.55} color="#94A3B8">
                            Your guess:
                          </ComicText>
                          <div className="mt-1 text-xl font-bold text-emerald-300">
                            {winningGuess}
                          </div>
                        </div>
                        <div className="my-2 flex items-center justify-center gap-2">
                          <div className="h-px flex-1 bg-blue-600/50"></div>
                          <div 
                            className="rounded-full px-2 py-0.5 border"
                            style={{ 
                              backgroundColor: 'rgba(167, 139, 250, 0.2)',
                              borderColor: '#A78BFA'
                            }}
                          >
                            <ComicText size={0.45} color="#C4B5FD">
                              ✨ close match
                            </ComicText>
                          </div>
                          <div className="h-px flex-1 bg-blue-600/50"></div>
                        </div>
                        <div className="mt-2">
                          <ComicText size={0.55} color="#94A3B8">
                            Original answer:
                          </ComicText>
                          <div className="mt-1 text-xl font-bold text-white">
                            {gameData?.word.toUpperCase()}
                          </div>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <ComicText size={0.55} color="#94A3B8">
                          The answer was:
                        </ComicText>
                        <div className="mt-1 text-xl font-bold text-white">
                          {gameData?.word.toUpperCase()}
                        </div>
                      </>
                    );
                  }
                })()}
              </div>

              {isScoreSaving ? (
                <div className="flex flex-col items-center justify-center p-3">
                  <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <ComicText size={0.6} color="#fff">
                    Calculating your score...
                  </ComicText>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  {/* Comment Results Button - Only show if user didn't give up */}
                  {gifHintCount < 999 && (
                    <button
                      onClick={handlePostComment}
                      disabled={isCommentPosting || isCommentPosted}
                      className={`flex w-full sm:w-48 cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-white transition-all duration-300 disabled:cursor-not-allowed ${
                        isCommentPosted
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg hover:shadow-xl'
                          : isCommentPosting
                            ? 'bg-gradient-to-r from-indigo-400 to-purple-500 opacity-90 shadow-md'
                            : 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-lg hover:scale-105 hover:shadow-xl'
                      } ${
                        !isCommentPosted && !isCommentPosting ? 'animate-blink-button' : ''
                      }`}
                      aria-label={isCommentPosted ? 'Commented!' : 'Comment Results'}
                      title={isCommentPosted ? 'Commented!' : 'Comment Results'}
                      style={{
                        minWidth: '192px',
                        boxShadow: isCommentPosted
                          ? '0 6px 16px rgba(16,185,129,0.4)'
                          : isCommentPosting
                            ? '0 6px 16px rgba(99,102,241,0.3)'
                            : '0 4px 12px rgba(217,119,6,0.4)'
                      }}
                    >
                      <span className="text-lg">
                        {isCommentPosted ? '✅' : isCommentPosting ? '⏳' : '💬'}
                      </span>
                      <span className="whitespace-nowrap">
                        <div style={{ fontFamily: 'Comic Sans MS, cursive, sans-serif', fontSize: '16px' }}>
                          {isCommentPosted ? 'Commented!' : isCommentPosting ? 'Commenting…' : 'Comment Results'}
                        </div>
                      </span>
                    </button>
                  )}

                  {/* View Results Button - Secondary */}
                  <button
                    onClick={() => {
                      if (gameData?.id) {
                        onNavigate('gameResults', { gameId: gameData.id });
                      }
                    }}
                    className="flex w-full sm:w-48 cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                    aria-label="View Results"
                    title="View Results"
                    style={{
                      minWidth: '192px',
                      boxShadow: '0 6px 16px rgba(37,99,235,0.4)'
                    }}
                  >
                    <span className="text-lg">📊</span>
                    <span className="whitespace-nowrap">
                      <ComicText size={0.6} color="white">
                        View Results
                      </ComicText>
                    </span>
                  </button>
                </div>
              )}

              {finalScore && !isScoreSaving && (
                <div className="mt-3 text-center">
                  <div className="bg-opacity-60 border-opacity-60 inline-block rounded-full border border-blue-500 bg-blue-900 px-5 py-1.5 shadow-lg">
                    <ComicText size={0.6} color="#FFFFFF">
                      Your Score: <span className="text-xl text-cyan-300">{finalScore.score}</span>
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
      {/* Incorrect Guess Popup */}
      {showIncorrectPopup && (
        <>
          <div className="fixed inset-0 z-[60] backdrop-blur-sm transition-all duration-300" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}></div>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
            <div className="animate-popup-bounce">
              <img 
                src="/game-page/incorrect-guess.gif" 
                alt="Incorrect Guess"
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>
          </div>
        </>
      )}
      
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

        @keyframes shake-box {
          0%, 100% { 
            transform: translateX(0) rotate(0deg) !important;
          }
          10% { 
            transform: translateX(-12px) rotate(-4deg) !important;
          }
          20% { 
            transform: translateX(12px) rotate(4deg) !important;
          }
          30% { 
            transform: translateX(-12px) rotate(-4deg) !important;
          }
          40% { 
            transform: translateX(12px) rotate(4deg) !important;
          }
          50% { 
            transform: translateX(-10px) rotate(-3deg) !important;
          }
          60% { 
            transform: translateX(10px) rotate(3deg) !important;
          }
          70% { 
            transform: translateX(-8px) rotate(-2deg) !important;
          }
          80% { 
            transform: translateX(8px) rotate(2deg) !important;
          }
          90% { 
            transform: translateX(-4px) rotate(-1deg) !important;
          }
        }

        @keyframes popup-bounce {
          0% { 
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% { 
            transform: scale(1.1) rotate(10deg);
            opacity: 1;
          }
          70% { 
            transform: scale(0.95) rotate(-5deg);
          }
          100% { 
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        .animate-popup-bounce {
          animation: popup-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }

        @keyframes blink-button {
          0% { 
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(217,119,6,0.4);
          }
          25% { 
            transform: scale(0.92);
            box-shadow: 0 2px 8px rgba(217,119,6,0.3);
          }
          50% { 
            transform: scale(1.08);
            box-shadow: 0 8px 24px rgba(217,119,6,0.8), 0 0 20px rgba(217,119,6,0.6);
          }
          75% { 
            transform: scale(0.96);
            box-shadow: 0 3px 10px rgba(217,119,6,0.35);
          }
          100% { 
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(217,119,6,0.4);
          }
        }

        .animate-blink-button {
          animation: blink-button 1.2s ease-in-out infinite;
        }

        @keyframes letter-vanish {
          0% { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
          50% { 
            opacity: 0.5; 
            transform: scale(1.3) translateY(-10px); 
          }
          100% { 
            opacity: 0; 
            transform: scale(0.3) translateY(-30px) rotate(180deg); 
          }
        }

        .error-banner {
          position: fixed;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          padding: 16px 32px;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4);
          transition: top 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .error-banner.show {
          top: 20px;
        }

        .error-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .error-emoji {
          font-size: 28px;
          animation: emoji-bounce 0.6s ease-in-out;
        }

        @keyframes emoji-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        .error-text {
          color: white;
        }

        .error-title {
          font-family: "Comic Sans MS", cursive, sans-serif;
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 0.5px;
        }

        .error-subtitle {
          font-family: "Comic Sans MS", cursive, sans-serif;
          font-size: 14px;
          margin-top: 2px;
          opacity: 0.9;
        }

        @keyframes modal-fade-in {
          0% { opacity: 0; transform: scale(0.9) translateY(-20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        .animate-modal-fade-in {
          animation: modal-fade-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
      {!isLoading && !error && gameData && (
        <div
          ref={questionRef}
          className="mb-6 translate-y-4 transform px-4 text-center opacity-0 transition-all duration-500"
        >
        </div>
      )}
      <div
        ref={gifAreaRef}
        className="flex w-full flex-1 translate-y-4 transform flex-col items-center justify-center opacity-0 transition-all duration-500"
      >
        {renderGifArea()}
      </div>
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
              ? 'GIF Hint'
              : `GIF Hint (${gifHintCount}/${gameData?.gifs?.length || 4})`}
          </ComicText>
        </button>
      </div>

      {gameData && gameData.category && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="flex items-center">
            <span className="mr-1">
              {gameData.category === 'Cinematic Feels'
                ? '🎬'
                : gameData.category === 'Gaming Moments'
                  ? '🎮'
                  : gameData.category === 'Story Experiences'
                    ? '📚'
                    : '🔥'}
            </span>
            <ComicText size={0.6} color={colors.textSecondary}>
              <span style={{ fontWeight: 'bold' }}>{gameData.category}</span>
            </ComicText>
          </div>
          
          {/* Difficulty Badge */}
          <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ 
            backgroundColor: `${getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}20`,
            border: `1.5px solid ${getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}`,
          }}>
            <span>{getDifficultyEmoji(gameData.difficulty || calculateDifficulty(gameData.word))}</span>
            <ComicText size={0.55} color={getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}>
              {gameData.difficulty || calculateDifficulty(gameData.word)}
            </ComicText>
          </div>
        </div>
      )}
      <div
        ref={answerBoxesContainerRef}
        className="mt-1 w-full max-w-4xl translate-y-4 transform opacity-0 transition-all duration-500"
      >
        {renderAnswerBoxes()}
      </div>
      <div
        ref={bottomBarRef}
        className="mt-2 flex w-full max-w-4xl translate-y-4 transform items-center justify-center gap-4 rounded-full p-4 opacity-0 shadow-lg transition-all duration-500 max-sm:flex-col"
      >
        <div className="flex gap-2">
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
          <button
            onClick={handleGiveUp}
            disabled={!gameData || isLoading || gameFlowState !== 'playing'}
            className="cursor-pointer rounded-full px-4 py-2 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#ef4444' }}
          >
            <ComicText size={0.6} color="white">
              🏳️ Give Up
            </ComicText>
          </button>
        </div>
        <div className="mx-auto w-64">
          <div className="mx-auto w-64">
            <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1 shadow-lg transition-shadow duration-300 hover:shadow-2xl">
              <input
                type="text"
                placeholder="TYPE YOUR GUESS"
                value={guess}
                onChange={handleGuessChange}
                onKeyDown={handleKeyDown}
                className="w-full rounded-full bg-white px-5 py-2.5 text-center tracking-widest uppercase focus:ring-2 focus:ring-blue-400 focus:outline-none"
                style={{ fontFamily: '"Comic Sans MS", cursive, sans-serif' }}
              />
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            handleGuess();
          }}
          disabled={!gameData || isLoading || guess.length === 0}
          className="cursor-pointer rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.65} color="white">
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
