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
import {
  calculateDifficulty,
  getDifficultyEmoji,
  getDifficultyColor,
} from '../utils/difficultyCalculator';
import {
  getCurrentUser,
  getGame,
  getGameState,
  saveGameState,
  validateGuess,
  trackGuess,
  hasUserCompletedGame,
  markGameCompleted,
  saveScore,
  calculateScore,
  getGameLeaderboard,
  getRandomGame,
} from '../lib/api';

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
  // Jumbled letter system states
  const [jumbledLetters, setJumbledLetters] = useState<string[]>([]);
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [availableIndices, setAvailableIndices] = useState<number[]>([]);
  const [selectionHistory, setSelectionHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
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
  const lastSubmittedGuessRef = useRef<string>('');
  const [showIncorrectPopup, setShowIncorrectPopup] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const gifAreaRef = useRef<HTMLDivElement>(null);
  const answerBoxesContainerRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const hintButtonRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Client-side score calculation (same logic as server)
  const calculateScoreClientSide = (params: {
    word: string;
    gifHintCount: number;
    revealedLetterCount: number;
    timeTaken: number;
  }): {
    score: number;
    gifPenalty: number;
    wordPenalty: number;
    timeTaken: number;
  } => {
    const { word, gifHintCount, revealedLetterCount, timeTaken } = params;

    const cleanWord = word.replace(/\s+/g, '');
    const wordLength = cleanWord.length;

    let score = 100;
    let gifPenalty = 0;
    let wordPenalty = 0;

    if (gifHintCount >= 2) {
      if (gifHintCount === 2) {
        gifPenalty = 10;
      } else if (gifHintCount === 3) {
        gifPenalty = 20;
      } else if (gifHintCount >= 4) {
        gifPenalty = 40;
      }
    }

    if (revealedLetterCount > 0 && wordLength >= 5) {
      let hintsUsed = 0;
      let lettersPerHint = 2;

      if (wordLength >= 5 && wordLength <= 7) {
        lettersPerHint = 2;
        hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
        wordPenalty = hintsUsed * 50;
      } else if (wordLength >= 8 && wordLength <= 10) {
        lettersPerHint = 2;
        hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
        wordPenalty = hintsUsed * 25;
      } else if (wordLength >= 11 && wordLength <= 15) {
        lettersPerHint = 2;
        hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
        wordPenalty = hintsUsed * 15;
      } else if (wordLength >= 16 && wordLength <= 25) {
        lettersPerHint = 3;
        hintsUsed = Math.ceil(revealedLetterCount / lettersPerHint);
        wordPenalty = hintsUsed * 10;
      }
    }

    score = Math.max(0, score - gifPenalty - wordPenalty);

    return { score, gifPenalty, wordPenalty, timeTaken };
  };

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const backgroundColor = isDarkMode ? '' : 'bg-[#E8E5DA]';
  const answerBoxborders = isDarkMode ? '' : 'border border-black';

  // Scramble array function with displacement guarantee
  const scrambleArray = (arr: string[]) => {
    if (arr.length <= 1) return [...arr];

    let bestShuffle = [...arr];
    let minInPlace = arr.length;
    const maxAttempts = 50;

    // Calculate how many letters can stay in place (max 20% for arrays with 5+ items)
    const maxInPlace = arr.length >= 5 ? Math.floor(arr.length * 0.2) : arr.length >= 3 ? 1 : 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const shuffled = [...arr];

      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Count letters in original position
      let inPlace = 0;
      for (let i = 0; i < arr.length; i++) {
        if (shuffled[i] === arr[i]) inPlace++;
      }

      // If this shuffle is good enough, use it
      if (inPlace <= maxInPlace) {
        return shuffled;
      }

      // Track best shuffle so far
      if (inPlace < minInPlace) {
        minInPlace = inPlace;
        bestShuffle = [...shuffled];
      }
    }

    // Return best shuffle found (even if not perfect)
    return bestShuffle;
  };

  // Handle clicking on jumbled letter
  const handleJumbledLetterClick = (index: number) => {
    if (gameFlowState === 'won' || gameFlowState === 'completed') return;
    if (!gameData) return;

    const letter = jumbledLetters[index];

    // Find the next empty position (fill any empty slot, including revealed hint positions)
    const totalPositions = gameData.word.replace(/\s+/g, '').length;
    let targetPosition = -1;

    for (let i = 0; i < totalPositions; i++) {
      if (!selectedLetters[i]) {
        targetPosition = i;
        break;
      }
    }

    if (targetPosition === -1) return;

    // Insert letter at the target position
    const newSelectedLetters = [...selectedLetters];
    newSelectedLetters[targetPosition] = letter;
    setSelectedLetters(newSelectedLetters);

    // Remove this letter from available pool
    const newAvailableIndices = availableIndices.filter((i) => i !== index);
    setAvailableIndices(newAvailableIndices);

    // Track selection history for undo
    setSelectionHistory([...selectionHistory, index]);

    // Update guess string (only non-revealed letters)
    const guessStr = newSelectedLetters.filter((l) => l).join('');
    setGuess(guessStr);
  };

  // Handle undo - remove last selected letter
  const handleUndo = () => {
    if (gameFlowState === 'won' || gameFlowState === 'completed') return;
    if (selectionHistory.length === 0) return;

    // Get the last selected index
    const lastIndex = selectionHistory[selectionHistory.length - 1];

    // Find and remove the last selected letter (rightmost non-empty, non-revealed)
    const newSelectedLetters = [...selectedLetters];
    for (let i = newSelectedLetters.length - 1; i >= 0; i--) {
      if (newSelectedLetters[i]) {
        newSelectedLetters[i] = '';
        break;
      }
    }

    setSelectedLetters(newSelectedLetters);

    // Return the index to available pool
    setAvailableIndices([...availableIndices, lastIndex].sort((a, b) => a - b));

    // Remove from history
    setSelectionHistory(selectionHistory.slice(0, -1));

    // Update guess string
    const guessStr = newSelectedLetters.filter((l) => l).join('');
    setGuess(guessStr);
  };

  // Handle clicking on answer box to remove letter
  const handleAnswerBoxClick = (position: number) => {
    if (gameFlowState === 'won' || gameFlowState === 'completed') return;
    if (!selectedLetters[position]) return; // No letter at this position

    const newSelectedLetters = [...selectedLetters];
    newSelectedLetters[position] = '';
    setSelectedLetters(newSelectedLetters);

    // Find the original index of this letter in jumbledLetters and add it back
    // We need to find the index from selection history
    const historyIndex = selectionHistory[selectionHistory.length - 1];

    if (historyIndex !== undefined) {
      setAvailableIndices([...availableIndices, historyIndex].sort((a, b) => a - b));
      setSelectionHistory(selectionHistory.slice(0, -1));
    }

    // Update guess string
    const guessStr = newSelectedLetters.filter((l) => l).join('');
    setGuess(guessStr);
  };

  // Shuffle the jumbled letters
  const handleShuffle = () => {
    if (gameFlowState === 'won' || gameFlowState === 'completed') return;
    const currentLetters = jumbledLetters.filter((_, idx) => availableIndices.includes(idx));
    const scrambled = scrambleArray(currentLetters);

    // Rebuild jumbled letters array maintaining selected letters' positions
    const newJumbled = [...jumbledLetters];
    let scrambledIdx = 0;
    availableIndices.forEach((idx) => {
      newJumbled[idx] = scrambled[scrambledIdx++];
    });

    setJumbledLetters(newJumbled);
  };

  // ✅ REFACTORED: Main useEffect for loading game data
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

    // ✅ REFACTORED: Fetch game data using API instead of postMessage
    async function loadGameData() {
      try {
        // Get current user
        const userResult = await getCurrentUser();
        if (userResult.success && userResult.username) {
          setUsername(userResult.username);
        } else {
          setUsername('anonymous');
        }

        // Get game data
        const gameResult = await getGame(propGameId!);
        setIsLoading(false);

        if (gameResult.success && gameResult.game) {
          const loadedGameData = gameResult.game;
          setGameData(loadedGameData);
          setGameFlowState('playing');
          setIsCorrect(null);

          const letters = loadedGameData.word.replace(/\s+/g, '').toUpperCase().split('');
          const scrambled = scrambleArray([...letters]);
          setJumbledLetters(scrambled);
          setAvailableIndices(letters.map((_: any, idx: number) => idx));

          const savedRevealedLetters = localStorage.getItem(`revealedLetters:${loadedGameData.id}`);
          if (savedRevealedLetters) {
            try {
              const parsed = JSON.parse(savedRevealedLetters);
              setRevealedLetters(new Set(parsed));
            } catch (e) {
              setRevealedLetters(new Set());
            }
          }

          addToPlayedGames(loadedGameData.id);
        } else {
          setError(gameResult.error || 'Game could not be loaded');
        }
      } catch (error) {
        setIsLoading(false);
        setError('Failed to load game');
      }
    }

    loadGameData();
    loadPlayedGameIds();

    return () => {
      cancelAnimationFrame(animationTimeout);
    };
  }, [propGameId]);

  useEffect(() => {
    if (gameData?.id && username && username !== 'anonymous') {
      async function loadState() {
        // Get game state
        const stateResult = await getGameState(username!, gameData!.id);
        if (stateResult.success && stateResult.state?.playerState) {
          const playerState = stateResult.state.playerState;

          if (typeof playerState.gifHintCount === 'number') {
            const restoredGifHintCount =
              playerState.gifHintCount > 0 ? playerState.gifHintCount : 1;
            setGifHintCount(restoredGifHintCount);
          } else {
            setGifHintCount(1);
          }

          if (
            Array.isArray(playerState.revealedLetters) &&
            playerState.revealedLetters.length > 0
          ) {
            setRevealedLetters(new Set(playerState.revealedLetters));
          } else {
            setRevealedLetters(new Set());
          }

          if (playerState.guess) {
            setGuess(playerState.guess);
          }

          if (playerState.isCompleted) {
            setGameFlowState('completed');
          }
        }

        // Check if user has completed this game
        const completedResult = await hasUserCompletedGame(username!, gameData!.id);
        if (completedResult.success && completedResult.hasCompleted) {
          setGameFlowState('completed');
        }
      }

      loadState();
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
        hasGivenUp: gifHintCount === 999 ? true : undefined,
      };

      // ✅ REFACTORED: Save game state using API
      saveGameState(username || 'anonymous', gameData.id, playerState);
    }
  }, [gameData, username, gifHintCount, revealedLetters, guess, gameFlowState, guessCount]);

  useEffect(() => {
    if (isCorrect === true) {
      handleCorrectGuess();
      setIsSubmittingGuess(false);
    }
    if (isCorrect === false) {
      handleIncorrectGuess();
      setIsSubmittingGuess(false);
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

  const requestRandomGame = async () => {
    setIsLoading(true);
    try {
      const result = await getRandomGame(username || 'anonymous');
      setIsLoading(false);

      if (result.success && result.result && result.result.game) {
        const randomGameData = result.result.game;
        if (
          !randomGameData.gifs ||
          !Array.isArray(randomGameData.gifs) ||
          randomGameData.gifs.length === 0
        ) {
          // Try again if no valid GIFs
          requestRandomGame();
          return;
        }

        setGameData(randomGameData);
        setGameFlowState('playing');
        setGameId(randomGameData.id);
        setRevealedLetters(new Set());
        setGuess('');
        setGifHintCount(1);
        setIsCorrect(null);

        // Initialize jumbled letters
        const letters = randomGameData.word.replace(/\s+/g, '').toUpperCase().split('');
        const scrambled = scrambleArray([...letters]);
        setJumbledLetters(scrambled);
        setAvailableIndices(letters.map((_: any, idx: number) => idx));

        // Load revealed letter positions from localStorage
        const savedRevealedLetters = localStorage.getItem(`revealedLetters:${randomGameData.id}`);
        if (savedRevealedLetters) {
          try {
            const positions = JSON.parse(savedRevealedLetters);
            setRevealedLetters(new Set(positions));
          } catch (e) {
            setRevealedLetters(new Set());
          }
        }

        addToPlayedGames(randomGameData.id);
      } else {
        setError(result.error || 'Failed to load a random game');
      }
    } catch (error) {
      setIsLoading(false);
      setError('Failed to load a random game');
    }
  };

  const handleCorrectGuess = async () => {
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

      // Calculate score immediately (client-side) for instant display
      const timeTakenSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
      const calculatedScore = calculateScoreClientSide({
        word: gameData.word,
        gifHintCount: gifHintCount,
        revealedLetterCount: originalRevealedCount,
        timeTaken: timeTakenSeconds,
      });

      // Set score immediately for modal display
      setFinalScore({
        username: currentUsername,
        gameId: gameData.id,
        score: calculatedScore.score,
        gifPenalty: calculatedScore.gifPenalty,
        wordPenalty: calculatedScore.wordPenalty,
        timeTaken: calculatedScore.timeTaken,
        timestamp: Date.now(),
      });

      const playerState = {
        gifHintCount,
        revealedLetters: Array.from(allIndices),
        guess: gameData.word,
        lastPlayed: Date.now(),
        isCompleted: true,
      };

      await saveGameState(currentUsername, gameData.id, playerState);
      await markGameCompleted({
        username: currentUsername,
        gameId: gameData.id,
        gifHintCount,
        revealedLetters: Array.from(allIndices),
        finalGuess: gameData.word,
        timeTaken: timeTakenSeconds,
      });

      const scoreResult = await calculateScore({
        word: gameData.word,
        gifHintCount: gifHintCount,
        revealedLetterCount: originalRevealedCount,
        timeTaken: timeTakenSeconds,
        username: currentUsername,
      });

      if (scoreResult.success && scoreResult.result) {
        // Save the calculated score
        await saveScore({
          ...scoreResult.result,
          username: currentUsername,
          gameId: gameData.id,
          timestamp: Date.now(),
        });
      }

      const boxes = document.querySelectorAll('.answer-box');
      boxes.forEach((box) => {
        (box as HTMLElement).style.backgroundColor = '#86efac';
        (box as HTMLElement).style.transition = 'background-color 0.5s ease';
      });

      createConfetti();
    }
  };

  const handleIncorrectGuess = () => {
    setShowIncorrectPopup(true);

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    const boxes = document.querySelectorAll('.answer-box');
    boxes.forEach((box, index) => {
      setTimeout(() => {
        const boxElement = box as HTMLElement;

        // Phase 1: Shake animation - disable transitions and force animation
        boxElement.style.transition = 'none';
        boxElement.style.animation = 'none';
        boxElement.style.transform = 'none';
        void boxElement.offsetWidth;

        boxElement.style.animation = 'shake-box 0.6s cubic-bezier(.36,.07,.19,.97) both';
        boxElement.style.animationFillMode = 'both';

        setTimeout(() => {
          // Phase 2: Letters vanish with fade and scale out
          const letterContent = boxElement.querySelector(
            'div[style*="position: relative"]'
          ) as HTMLElement;
          if (letterContent && letterContent.textContent && letterContent.textContent.trim()) {
            letterContent.style.animation = 'letter-vanish 0.4s ease-out forwards';
          }

          // Phase 3: Box flash red
          boxElement.style.backgroundColor = '#fca5a5';
          boxElement.style.transition = 'background-color 0.2s ease';

          setTimeout(() => {
            // Phase 4: Reset everything
            boxElement.style.backgroundColor = '';
            boxElement.style.animation = '';
            boxElement.style.transform = '';
            boxElement.style.transition = '';
            boxElement.style.animationFillMode = '';

            // Clear the letter content animation
            if (letterContent) {
              letterContent.style.animation = 'none';
            }
          }, 600);
        }, 600);
      }, index * 40);
    });

    setTimeout(() => {
      setShowIncorrectPopup(false);
      setSelectedLetters([]);
      setSelectionHistory([]);
      if (gameData) {
        const letters = gameData.word.replace(/\s+/g, '').toUpperCase().split('');
        setAvailableIndices(letters.map((_, idx) => idx));
      }
      setGuess('');
      setIsCorrect(null);
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

  // ✅ REFACTORED: Handle give up with API calls
  const handleGiveUp = async () => {
    if (!gameData) return;

    const currentUsername = username || 'anonymous';
    const timeTakenSeconds = Math.floor((Date.now() - gameStartTime) / 1000);

    const allIndices = new Set<number>();
    for (let i = 0; i < gameData.word.length; i++) {
      if (gameData.word[i] !== ' ') {
        allIndices.add(i);
      }
    }
    setRevealedLetters(allIndices);
    setGuess(gameData.word.toUpperCase());
    setGifHintCount(999);

    setGameFlowState('completed');
    setFinalScore({
      username: currentUsername,
      gameId: gameData.id,
      score: 0,
      gifPenalty: 100,
      wordPenalty: 0,
      timeTaken: timeTakenSeconds,
      timestamp: Date.now(),
    });

    // ✅ REFACTORED: Send completion message - server will resolve username if it's 'anonymous'
    await markGameCompleted({
      username: currentUsername,
      gameId: gameData.id,
      gifHintCount: 999,
      revealedLetters: Array.from(allIndices),
      finalGuess: gameData.word,
      hasGivenUp: true,
      timeTaken: timeTakenSeconds,
    });

    // ✅ REFACTORED: Save score of 0
    await saveScore({
      score: 0,
      gifPenalty: 100,
      wordPenalty: 0,
      timeTaken: timeTakenSeconds,
      username: currentUsername,
      gameId: gameData.id,
      timestamp: Date.now(),
    });

    // ✅ REFACTORED: Get game leaderboard for results page
    const leaderboardResult = await getGameLeaderboard(gameData.id, 10);
    if (leaderboardResult.success && leaderboardResult.result?.leaderboard) {
      setLeaderboard(leaderboardResult.result.leaderboard);
    }
    onNavigate('gameResults', { gameId: gameData.id });
  };

  const answer = gameData ? gameData.word.toUpperCase() : '';

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
      return;
    }

    const toReveal = Math.min(revealCount, unrevealed.length);
    const newRevealed = new Set(revealedLetters);
    const revealedLettersInHint: string[] = [];

    unrevealed.sort((a, b) => a - b);

    const hintNumber = hintsUsedSoFar;
    for (let i = 0; i < toReveal; i++) {
      const positionIndex = (hintNumber * revealCount + i) % unrevealed.length;
      const posToReveal = unrevealed[positionIndex];
      newRevealed.add(posToReveal);
      revealedLettersInHint.push(answer[posToReveal]);
      unrevealed.splice(positionIndex, 1);
    }

    setRevealedLetters(newRevealed);

    if (gameData?.id) {
      localStorage.setItem(
        `revealedLetters:${gameData.id}`,
        JSON.stringify(Array.from(newRevealed))
      );
    }
  };

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

  // ✅ REFACTORED: Handle guess submission with API
  const handleGuess = async () => {
    if (isSubmittingGuess) {
      return;
    }

    setIsSubmittingGuess(true);
    setGuessCount((prevCount) => prevCount + 1);

    if (!gameData || !gameData.word) {
      setIsSubmittingGuess(false);
      return;
    }

    const answer = gameData.word.toUpperCase();
    let guessFromBoxes = '';
    let nonSpaceIndex = 0;

    for (let i = 0; i < answer.length; i++) {
      if (answer[i] === ' ') {
        guessFromBoxes += ' ';
      } else {
        if (selectedLetters[nonSpaceIndex]) {
          guessFromBoxes += selectedLetters[nonSpaceIndex];
        } else {
          guessFromBoxes += '_';
        }
        nonSpaceIndex++;
      }
    }

    const cleanedGuess = guessFromBoxes.replace(/\s+/g, '').toUpperCase();
    lastSubmittedGuessRef.current = cleanedGuess;

    if (cleanedGuess.includes('_')) {
      setIsCorrect(false);
      setIsSubmittingGuess(false);
      return;
    }

    try {
      // ✅ REFACTORED: Track the decode attempt - only track complete attempts
      if (gameData.id && username) {
        await trackGuess(username || 'anonymous', gameData.id, cleanedGuess);
      }

      // ✅ REFACTORED: Use server-side validation to check if attempt is correct
      const result = await validateGuess(username || 'anonymous', gameData.id, cleanedGuess);

      if (result.success) {
        setIsCorrect(result.isCorrect);
      } else {
        setIsCorrect(false);
      }

      setIsSubmittingGuess(false);
    } catch (error) {
      setIsCorrect(false);
      setIsSubmittingGuess(false);
    }
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

    const words = answer.split(' ');
    const isSingleWord = words.length === 1;

    // Create a flat array of non-space characters with their original positions
    const answerCharsWithPositions: Array<{
      char: string;
      originalIdx: number;
      nonSpaceIdx: number;
    }> = [];
    let nonSpaceCounter = 0;
    for (let i = 0; i < answer.length; i++) {
      if (answer[i] !== ' ') {
        answerCharsWithPositions.push({
          char: answer[i],
          originalIdx: i,
          nonSpaceIdx: nonSpaceCounter++,
        });
      }
    }

    // Get category icon for watermark
    const getCategoryIcon = () => {
      if (!gameData?.category) return '';
      switch (gameData.category) {
        case 'Cinematic Feels':
          return '🎬';
        case 'Gaming Moments':
          return '🎮';
        case 'Story Experiences':
          return '📚';
        default:
          return '🔥';
      }
    };
    const categoryIcon = getCategoryIcon();

    return (
      <div
        ref={answerBoxesRef}
        id="answer-boxes-container"
        className={`mt-5 flex flex-wrap items-center justify-center gap-2 transition-all duration-500`}
      >
        {words.map((word, wordIdx) => {
          // Get start position of this word in the original answer
          const wordStartPos = words.slice(0, wordIdx).reduce((sum, w) => sum + w.length + 1, 0);
          const wordEndPos = wordStartPos + word.length;

          // Filter chars that belong to this word
          const wordChars = answerCharsWithPositions.filter(
            (item) => item.originalIdx >= wordStartPos && item.originalIdx < wordEndPos
          );

          return (
            <div
              key={`word-${wordIdx}`}
              className={`flex items-center justify-center gap-2 ${isSingleWord ? 'flex-wrap' : 'flex-wrap'}`}
            >
              {wordChars.map((item, letterIdx) => {
                const isWon = gameFlowState === 'won' || gameFlowState === 'completed';
                const isRevealed = revealedLetters.has(item.originalIdx);

                // For jumbled system: show selected letters OR revealed letters
                const selectedLetter = selectedLetters[item.nonSpaceIdx];
                const revealedChar = isRevealed ? item.char : '';
                const isEmpty = !isWon && !selectedLetter && !isRevealed;

                let bgColor = 'bg-gray-200';
                if (isWon) {
                  bgColor = 'bg-green-200';
                } else if (isRevealed || selectedLetter) {
                  bgColor = 'bg-blue-100';
                }

                return (
                  <div
                    key={`${wordIdx}-${letterIdx}`}
                    onClick={() =>
                      !isEmpty && !isWon && !isRevealed && handleAnswerBoxClick(item.nonSpaceIdx)
                    }
                    className={`answer-box ${answerBoxborders} relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${bgColor} overflow-hidden transition-all duration-500 ${!isEmpty && !isWon && !isRevealed && selectedLetter ? 'cursor-pointer hover:bg-red-100' : ''}`}
                  >
                    {/* Category icon watermark inside each box - only show when empty */}
                    {categoryIcon && isEmpty && (
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        style={{
                          opacity: 0.12,
                          fontSize: '24px',
                          userSelect: 'none',
                          zIndex: 0,
                        }}
                      >
                        {categoryIcon}
                      </div>
                    )}
                    {/* Revealed letter (transparent background layer) */}
                    {revealedChar && (
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        style={{
                          fontFamily: 'Comic Sans MS, Comic Sans, cursive',
                          color: '#2563EB',
                          fontWeight: 'bold',
                          letterSpacing: '0.5px',
                          opacity: selectedLetter ? 0.25 : 1,
                          zIndex: 1,
                        }}
                      >
                        {revealedChar}
                      </div>
                    )}
                    {/* Selected letter (foreground layer) - shows on top */}
                    {selectedLetter && (
                      <div
                        style={{
                          fontFamily: 'Comic Sans MS, Comic Sans, cursive',
                          color: '#2563EB',
                          fontWeight: 'bold',
                          letterSpacing: '0.5px',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        {selectedLetter}
                      </div>
                    )}
                    {/* Won state - show correct answer */}
                    {isWon && (
                      <div
                        style={{
                          fontFamily: 'Comic Sans MS, Comic Sans, cursive',
                          color: '#2563EB',
                          fontWeight: 'bold',
                          letterSpacing: '0.5px',
                          position: 'relative',
                          zIndex: 3,
                        }}
                      >
                        {item.char}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Add word separator - visible divider between words (only for multi-word phrases) */}
              {!isSingleWord && wordIdx < words.length - 1 && (
                <div className="flex flex-shrink-0 items-center px-1">
                  <div className="h-8 w-0.5 rounded-full bg-gray-400 opacity-60"></div>
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

  useEffect(() => {
    if (gameFlowState === 'won' && gameData?.id) {
      // Wait for score modal to show, then navigate
      const navigationTimer = setTimeout(() => {
        onNavigate('gameResults', { gameId: gameData.id });
      }, 2000);

      return () => clearTimeout(navigationTimer);
    }
  }, [gameFlowState, gameData?.id, onNavigate]);

  // Show score modal overlay when won
  const renderScoreModal = () => {
    if (gameFlowState !== 'won') return null;

    return (
      <>
        <div
          className="fixed inset-0 z-40 backdrop-blur-md transition-all duration-500"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        ></div>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="animate-modal-fade-in relative rounded-2xl bg-gradient-to-br from-green-400 to-blue-500 p-8 text-center shadow-2xl"
            style={{ minWidth: '280px' }}
          >
            <div className="mb-3 text-6xl">🎉</div>
            <ComicText size={1.5} color="white">
              Hurray!
            </ComicText>
            <ComicText size={0.8} color="white">
              You guessed it right
            </ComicText>
            <div
              className="mt-4 rounded-xl bg-white/20 px-6 py-3 backdrop-blur-sm"
              style={{ minHeight: '80px' }}
            >
              {finalScore ? (
                <>
                  <ComicText size={0.6} color="white">
                    Your Score
                  </ComicText>
                  <div
                    className="text-4xl font-bold text-white"
                    style={{ fontFamily: 'Comic Sans MS, cursive' }}
                  >
                    {finalScore.score}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center" style={{ minHeight: '80px' }}>
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      key={gameKey}
      className={`${backgroundColor} flex min-h-screen flex-col items-center p-5 transition-opacity duration-500 select-none`}
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      {/* Incorrect Guess Popup */}
      {showIncorrectPopup && (
        <>
          <div
            className="fixed inset-0 z-[60] backdrop-blur-sm transition-all duration-300"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          ></div>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
            <div className="animate-popup-bounce">
              <img
                src="/game-page/incorrect-guess.gif"
                alt="Incorrect Guess"
                className="h-48 w-48 rounded-xl object-contain"
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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

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

        @keyframes pulse-click {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        @keyframes button-glow {
          0%, 100% { 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2), 0 0 8px 2px rgba(239, 68, 68, 0.3);
            filter: brightness(1);
          }
          50% { 
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3), 0 0 20px 4px rgba(239, 68, 68, 0.6);
            filter: brightness(1.15);
          }
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
        ></div>
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
          <div
            className="flex items-center gap-1 rounded-full px-3 py-1"
            style={{
              backgroundColor: `${getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}20`,
              border: `1.5px solid ${getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}`,
            }}
          >
            <span>
              {getDifficultyEmoji(gameData.difficulty || calculateDifficulty(gameData.word))}
            </span>
            <ComicText
              size={0.55}
              color={getDifficultyColor(gameData.difficulty || calculateDifficulty(gameData.word))}
            >
              {gameData.difficulty || calculateDifficulty(gameData.word)}
            </ComicText>
          </div>
        </div>
      )}
      <div
        ref={answerBoxesContainerRef}
        className="mt-0.5 w-full max-w-4xl translate-y-4 transform opacity-0 transition-all duration-500"
      >
        {renderAnswerBoxes()}
      </div>

      {/* Jumbled Letters Pool */}
      {gameData && gameFlowState === 'playing' && (
        <div className="mt-2 w-full max-w-4xl">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex min-h-[60px] flex-wrap justify-center gap-1.5 rounded-xl p-1.5">
              {jumbledLetters.map((letter, idx) => {
                const isAvailable = availableIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => handleJumbledLetterClick(idx)}
                    disabled={!isAvailable}
                    className={`h-9 w-9 rounded-lg text-xl font-bold uppercase shadow-md transition-all duration-200 ${
                      isAvailable
                        ? 'animate-[pulse-click_2s_ease-in-out_infinite,button-glow_2s_ease-in-out_infinite] cursor-pointer hover:scale-110 hover:shadow-lg active:scale-95'
                        : 'cursor-not-allowed opacity-30'
                    }`}
                    style={{
                      backgroundColor: isAvailable ? colors.primary : '#9ca3af',
                      color: 'white',
                      fontFamily: '"Comic Sans MS", cursive, sans-serif',
                      animationDelay: isAvailable ? `${(idx % 8) * 0.15}s` : '0s',
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            {/* Utility buttons row */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={selectionHistory.length === 0}
                className="cursor-pointer rounded-full px-2.5 py-1 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: '#4267B2' }}
              >
                <ComicText size={0.5} color="white">
                  ↶ Undo
                </ComicText>
              </button>
              <button
                onClick={handleShuffle}
                disabled={availableIndices.length === 0}
                className="cursor-pointer rounded-full px-2.5 py-1 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: '#f97316' }}
              >
                <ComicText size={0.5} color="white">
                  🔄 Shuffle
                </ComicText>
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={bottomBarRef}
        className="mt-2 flex w-full max-w-4xl translate-y-4 transform flex-col items-center justify-center gap-1.5 p-1.5 opacity-0 transition-all duration-500"
      >
        {/* Main action buttons - prominent */}
        <button
          onClick={() => {
            handleGuess();
          }}
          disabled={
            !gameData ||
            isLoading ||
            gameFlowState !== 'playing' ||
            isSubmittingGuess ||
            (() => {
              // Check if all positions are filled with selected letters
              if (!gameData) return true;
              const totalPositions = gameData.word.replace(/\s+/g, '').length;
              for (let i = 0; i < totalPositions; i++) {
                if (!selectedLetters[i]) {
                  return true;
                }
              }
              return false;
            })()
          }
          className="cursor-pointer rounded-full px-7 py-2.5 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: colors.primary }}
        >
          <ComicText size={0.7} color="white">
            DECODE IT!
          </ComicText>
        </button>

        {/* Secondary action buttons - smaller */}
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            onClick={handleWordHint}
            disabled={!gameData || isLoading || gameFlowState !== 'playing'}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: colors.primary }}
          >
            <ComicText size={0.55} color="white">
              💡 {gameData?.word.includes(' ') ? 'Phrase' : 'Word'} Hint
            </ComicText>
          </button>
          <button
            onClick={handleGiveUp}
            disabled={!gameData || isLoading || gameFlowState !== 'playing'}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#ef4444' }}
          >
            <ComicText size={0.55} color="white">
              🏳️ Give Up
            </ComicText>
          </button>
        </div>
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

      {renderScoreModal()}
    </div>
  );
};

export default GamePage;
