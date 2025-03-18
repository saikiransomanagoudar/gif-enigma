import React, { useState, useEffect } from 'react';
import { colors } from '../lib/styles';
import { ChewyText } from '../lib/fonts';
import { NavigationProps } from '../App';

export interface TenorGifResult {
  id: string;
  title: string;
  media_formats: {
    gif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    tinygif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    mediumgif?: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    [key: string]:
      | {
          url: string;
          dims: number[];
          duration: number;
          preview: string;
          size: number;
        }
      | undefined;
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

const getGifUrl = (gif: TenorGifResult | null): string => {
  console.log('Getting URL for GIF:', gif?.id);

  if (!gif || !gif.media_formats) {
    console.log('No GIF or media_formats');
    return '';
  }

  // Log available formats
  const availableFormats = Object.keys(gif.media_formats);
  console.log('Available formats:', availableFormats);

  // Try these formats in order of preference
  const preferredFormats = ['gif', 'tinygif', 'mediumgif', 'nanogif'];

  for (const format of preferredFormats) {
    const formatObj = gif.media_formats[format];
    if (formatObj && formatObj.url) {
      console.log(`Using ${format} URL:`, formatObj.url);
      return formatObj.url;
    }
  }

  // If none of the preferred formats worked, try any format with a URL
  for (const format of availableFormats) {
    const formatObj = gif.media_formats[format];
    if (formatObj && formatObj.url) {
      console.log(`Falling back to ${format} URL:`, formatObj.url);
      return formatObj.url;
    }
  }

  console.log('No valid URL found for GIF');
  return '';
};

export interface CreatePageProps extends NavigationProps {
  context: any;
}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate }) => {
  // Core game data
  const [secretInput, setSecretInput] = useState<string>('');
  const [tempSecretInput, setTempSecretInput] = useState<string>('');
  const [inputType, setInputType] = useState<'word' | 'phrase'>('word');
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  //@ts-ignore
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tempSearchTerm, setTempSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<TenorGifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<(TenorGifResult | null)[]>([]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);
  const [selectedGifInModal, setSelectedGifInModal] = useState<TenorGifResult | null>(null);

  // UI states
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  // @ts-ignore
  const [message, setMessage] = useState<string>('');
  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [postToSubreddit, setPostToSubreddit] = useState<boolean>(true);

  // Modal states
  const [showSecretInput, setShowSecretInput] = useState<boolean>(false);
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
  const [gifUrls, setGifUrls] = useState<string[]>([]);

  // Validate secret input
  const validateSecretInput = (input: string): boolean => {
    if (!input || input.trim() === '') return false;

    const processedInput = input.trim().toUpperCase();
    return processedInput.length >= 5;
  };

  // Handle secret input
  const handleSetSecretInput = () => {
    setShowSecretInput(true);
    setTempSecretInput(secretInput);
  };

  // State for modal error message
  const [modalError, setModalError] = useState<string>('');

  const confirmSecretInput = () => {
    if (validateSecretInput(tempSecretInput)) {
      // Always store in uppercase
      setSecretInput(tempSecretInput.trim().toUpperCase());
      setShowSecretInput(false);
      setModalError('');
    } else {
      setModalError('Input must be 5 characters long including spaces.');
    }
  };

  // Handle search term input for a specific gif slot
  const handleSetSearchTerm = (index: number) => {
    setSelectedGifIndex(index);
    setShowSearchInput(true);
    setTempSearchTerm('');
    setGifs([]);
    // Reset message when opening search modal
    setMessage('');
    setMessageType('info');
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (!message || typeof message !== 'object') return;

      console.log('Received message:', message.type);

      // Clear any timeout first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Handle GIF search results
      if (message.type === 'SEARCH_TENOR_GIFS_RESULT' || message.type === 'SEARCH_GIFS_RESULT') {
        // Always stop loading first
        setIsSearching(false);
        console.log('Search complete, setting isSearching=false');

        try {
          if (message.success && message.results && Array.isArray(message.results)) {
            console.log(`Found ${message.results.length} GIFs`);

            // Extract URL strings
            const urls = message.results
              .map(
                (gif: {
                  media_formats: {
                    [x: string]: { url: any };
                    gif: { url: any };
                    tinygif: { url: any };
                    mediumgif: { url: any };
                    nanogif: { url: any };
                  };
                }) => {
                  if (gif.media_formats) {
                    if (gif.media_formats.gif?.url) return gif.media_formats.gif.url;
                    if (gif.media_formats.tinygif?.url) return gif.media_formats.tinygif.url;
                    if (gif.media_formats.mediumgif?.url) return gif.media_formats.mediumgif.url;
                    if (gif.media_formats.nanogif?.url) return gif.media_formats.nanogif.url;

                    // Try any other format
                    for (const format in gif.media_formats) {
                      if (gif.media_formats[format]?.url) {
                        return gif.media_formats[format].url;
                      }
                    }
                  }
                  return null;
                }
              )
              .filter((url: null) => url !== null) as string[];

            console.log(`Extracted ${urls.length} URLs`);

            // Update both states
            setGifUrls(urls);
            setGifs(message.results);

            // Update message
            if (urls.length === 0) {
              setMessage('No GIFs found. Try a different search term.');
              setMessageType('info');
            } else {
              setMessage(`Found ${urls.length} GIFs from Tenor.`);
              setMessageType('success');
            }
          } else {
            console.log('No results or search failed');
            setGifUrls([]);
            setGifs([]);
            setMessage('No GIFs found. Try a different search term.');
            setMessageType('info');
          }
        } catch (error) {
          console.error('Error processing search results:', error);
          setGifUrls([]);
          setGifs([]);
          setMessage('Error processing results. Please try again.');
          setMessageType('error');
        }
      }

      // Handle game creation result
      if (message.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);

        if (message.success && message.result && message.result.success) {
          const result = message.result;
          const successMessage = result.postedToReddit
            ? `Game created and posted to r/PlayGIFEnigma! Game ID: ${result.gameId}`
            : `Game created successfully! Game ID: ${result.gameId}`;

          setMessage(successMessage);
          setMessageType('success');

          // Reset form
          setSecretInput('');
          setSelectedGifs([]);
          setGifs([]);
          setGifUrls([]);
          setSearchTerm('');
        } else {
          setMessage(
            `Failed to create game: ${message.error || message.result?.error || 'Unknown error'}`
          );
          setMessageType('error');
        }
      }

      // Handle recent games result
      if (message.type === 'GET_RECENT_GAMES_RESULT') {
        if (message.success && message.result && message.result.success) {
          console.log('Received recent games:', message.result.games);
          // Update your recent games state here if needed
        } else {
          console.error('Failed to get recent games:', message.error || message.result?.error);
        }
      }

      // Handle single game result
      if (message.type === 'GET_GAME_RESULT') {
        if (message.success && message.result && message.result.success) {
          console.log('Received game data:', message.result.game);
          // Update your game state here if needed
        } else {
          console.error('Failed to get game:', message.error || message.result?.error);
        }
      }

      // Handle initialization response
      if (message.type === 'INIT_RESPONSE') {
        console.log('App initialized with data:', message.payload);
        // Handle initialization data
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);

    // Cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    console.log('gifs updated:', gifs);
  }, [gifs]);

  useEffect(() => {
    console.log('isSearching updated:', isSearching);
  }, [isSearching]);

  const searchGifs = async (term: string) => {
    if (!term) return;

    // Reset all states
    setGifs([]);
    setGifUrls([]); // Clear the URLs
    setIsSearching(true);
    setSelectedGifInModal(null);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      console.log(`Searching for: ${term}`);
      window.parent.postMessage(
        {
          type: 'SEARCH_TENOR_GIFS',
          data: {
            query: term,
            limit: 8,
          },
        },
        '*'
      );

      // Set a timeout
      timeoutRef.current = setTimeout(() => {
        console.log('Search timed out after 8 seconds');
        setIsSearching(false);
      }, 8000);
    } catch (error) {
      console.error('Error initiating search:', error);
      setIsSearching(false);
    }
  };

  const selectGifForSlot = (gif: TenorGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      // Get URL with better logging
      const gifUrl = getGifUrl(gif);
      console.log(`Selecting GIF ${gif.id} with URL: ${gifUrl}`);

      if (!gifUrl) {
        console.log('No valid URL found for GIF');
        setMessage('Unable to load this GIF. Please try another one.');
        setMessageType('error');
        return;
      }

      // Create a clean copy to avoid reference issues
      const cleanGif = JSON.parse(JSON.stringify(gif));

      // Create a new array to ensure React detects the change
      const newSelectedGifs = [...selectedGifs];
      newSelectedGifs[selectedGifIndex] = cleanGif;

      // Update state
      setSelectedGifs(newSelectedGifs);
      setShowSearchInput(false);
      setSelectedGifInModal(null);
      setGifs([]);
      setMessage('GIF selected successfully!');
      setMessageType('success');
    }
  };

  // Remove a GIF from a specific slot
  const removeGifFromSlot = (index: number) => {
    const newSelectedGifs = [...selectedGifs];
    newSelectedGifs[index] = null;
    setSelectedGifs(newSelectedGifs);
  };

  // Toggle hint visibility
  const toggleHint = () => {
    setShowHint(!showHint);
  };

  // Toggle posting to subreddit
  const togglePostToSubreddit = () => {
    setPostToSubreddit(!postToSubreddit);
  };

  // const toggleInputType = () => {
  //   setInputType(inputType === 'word' ? 'phrase' : 'word');
  //   // Clear the current input when switching types
  //   setSecretInput('');
  // };

  const submitGame = () => {
    // Count non-null selected GIFs
    const validGifs = selectedGifs.filter((gif) => gif !== null);

    if (!secretInput) {
      setMessage(`Please enter a secret ${inputType} before creating a game.`);
      setMessageType('error');
      return;
    }

    if (validGifs.length !== 4) {
      setMessage(`Please select exactly 4 GIFs. You've selected ${validGifs.length} so far.`);
      setMessageType('error');
      return;
    }

    setIsCreating(true); // Only set creating state here
    setMessage('Creating your GIF Enigma game...');
    setMessageType('info');

    try {
      // Process the secret input to create a masked version
      const wordArray = secretInput.split('');
      const maskCount = Math.floor((wordArray.length * 2) / 3); // Mask ~2/3 of the letters
      const indicesToMask = new Set<number>();

      while (indicesToMask.size < maskCount) {
        indicesToMask.add(Math.floor(Math.random() * wordArray.length));
      }

      const maskedWord = wordArray
        .map((char, index) => (indicesToMask.has(index) ? (char === ' ' ? ' ' : '_') : char))
        .join('');

      // Generate default question text based on input type
      const questionText =
        inputType === 'word'
          ? 'Can you guess the word from these GIF clues?'
          : 'Can you guess the phrase from these GIF clues?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      // Send a message to the parent window to save the game
      window.parent.postMessage(
        {
          type: 'SAVE_GAME',
          data: {
            word: secretInput, // Already uppercase from validation
            maskedWord,
            questionText,
            gifs: gifUrls,
            postToSubreddit,
          },
        },
        '*'
      );

      // The actual result will be handled by the message listener in the useEffect
    } catch (error) {
      setIsCreating(false);
      setMessage(
        `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessageType('error');
    }
  };

  // Render GIF grid with 2x2 layout and add buttons - more compact
  const renderGifGrid = () => (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <ChewyText size={0.8} color={colors.textPrimary}>
          GIF Clues
        </ChewyText>
        <button
          onClick={toggleHint}
          className="cursor-pointer rounded-full px-3 py-1 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary, color: 'white' }}
        >
          <ChewyText size={0.5} color="white">
            {showHint ? '🙈 Hide' : '👁️ Show'}
          </ChewyText>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, index) => {
          const gif = selectedGifs[index];
          return (
            <div
              key={index}
              className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl"
              style={{
                backgroundColor: colors.cardBackground,
                border: gif ? 'none' : `3px dashed ${colors.secondary}`,
                transition: 'all 0.3s ease-in-out',
              }}
            >
              {gif ? (
                <div className="relative h-full w-full">
                  <div
                    className={`absolute inset-0 flex h-full w-full items-center justify-center p-3 text-center transition-all duration-300 ${
                      showHint ? 'bg-opacity-0' : 'bg-opacity-80 bg-black'
                    }`}
                  >
                    <ChewyText size={0.6} color={colors.textSecondary}>
                      {showHint
                        ? gif.content_description || `GIF ${index + 1}`
                        : `GIF ${index + 1}`}
                    </ChewyText>
                  </div>
                  <button
                    onClick={() => removeGifFromSlot(index)}
                    className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all duration-200 hover:scale-110"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSetSearchTerm(index)}
                  className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-4 transition-all duration-200 hover:scale-105"
                >
                  <div className="mb-2 text-3xl">➕</div>
                  <ChewyText size={0.6} color={colors.textSecondary}>
                    Add GIF #{index + 1}
                  </ChewyText>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const Modal = ({
    title,
    isOpen,
    onClose,
    onConfirm,
    children,
  }: {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    children: React.ReactNode;
  }) => {
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (isOpen && event.key === 'Enter') {
          onConfirm();
        }
      };

      // Add the event listener when the modal is open
      window.addEventListener('keydown', handleKeyDown);

      // Remove the event listener when the modal is closed or unmounted
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen, onConfirm]);

    if (!isOpen) return null;

    return (
      <div className="bg-opacity-75 fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div
          className="animate-bounce-once w-full max-w-sm rounded-xl p-4 transition-all duration-300"
          style={{
            backgroundColor: colors.cardBackground,
            boxShadow: `0 8px 20px rgba(${colors.primary.replace('#', '')}, 0.5)`,
            border: `2px solid ${colors.primary}`,
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <ChewyText size={0.8} color={colors.textPrimary}>
              {title}
            </ChewyText>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-white transition-all duration-200 hover:rotate-90 hover:bg-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="mb-3">{children}</div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-3 py-1.5 transition-all duration-200 hover:scale-95"
              style={{ backgroundColor: colors.error }}
            >
              <ChewyText size={0.5} color="white">
                Cancel
              </ChewyText>
            </button>
            <button
              onClick={onConfirm}
              className="rounded-full px-3 py-1.5 transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: colors.primary }}
            >
              <ChewyText size={0.5} color="white">
                Confirm
              </ChewyText>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // More compact fun toggle switch for Word/Phrase
  const InputTypeToggle = () => (
    <div className="flex items-center justify-center">
      <div
        className="relative flex h-10 items-center overflow-hidden rounded-full"
        style={{
          backgroundColor: '#2D3748', // Darker background
          border: `2px solid ${colors.primary}`,
          width: '160px',
        }}
      >
        {/* Sliding background - make it fill exactly half the container */}
        <div
          className="ease-bounce absolute h-full w-1/2 rounded-full transition-all duration-300"
          style={{
            backgroundColor: colors.primary,
            left: inputType === 'word' ? '0' : '50%',
            zIndex: 1,
          }}
        />

        <button
          onClick={() => setInputType('word')}
          className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center transition-all duration-200"
        >
          <ChewyText size={0.6} color={inputType === 'word' ? 'white' : colors.textSecondary}>
            Word
          </ChewyText>
        </button>

        {/* Phrase button - exactly 50% width */}
        <button
          onClick={() => setInputType('phrase')}
          className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center transition-all duration-200"
        >
          <ChewyText size={0.6} color={inputType === 'phrase' ? 'white' : colors.textSecondary}>
            Phrase
          </ChewyText>
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      {/* Secret Input Modal */}
      <Modal
        title={`Enter Secret ${inputType === 'word' ? 'Word' : 'Phrase'}`}
        isOpen={showSecretInput}
        onClose={() => setShowSecretInput(false)}
        onConfirm={confirmSecretInput}
      >
        <div className="flex flex-col gap-3">
          <div>
            <ChewyText size={0.6} color={colors.textSecondary}>
              {inputType === 'word'
                ? 'Enter a word with at least 5 letters.'
                : 'Enter a phrase with at least 2 words.'}
            </ChewyText>
          </div>
          <input
            type="text"
            value={tempSecretInput}
            onChange={(e) => setTempSecretInput(e.target.value)}
            className={`w-full rounded-xl border-2 ${modalError ? 'border-red-500' : 'border-gray-700'} bg-gray-800 p-3 text-white focus:border-blue-500 focus:outline-none`}
            placeholder={`Enter the secret ${inputType}`}
            autoFocus
          />
          {modalError && (
            <div className="bg-opacity-20 p-2">
              <ChewyText size={0.6} color="red">
                {modalError}
              </ChewyText>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title="Search for GIFs"
        isOpen={showSearchInput}
        onClose={() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setShowSearchInput(false);
          setIsSearching(false);
        }}
        onConfirm={() => {
          if (selectedGifInModal) {
            selectGifForSlot(selectedGifInModal);
          } else if (tempSearchTerm && tempSearchTerm.trim() !== '') {
            searchGifs(tempSearchTerm.trim());
          }
        }}
      >
        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempSearchTerm}
              onChange={(e) => setTempSearchTerm(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter' && tempSearchTerm.trim() !== '') {
                  searchGifs(tempSearchTerm.trim());
                }
              }}
              className="flex-grow rounded-xl border-2 border-gray-700 bg-gray-800 p-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Search Tenor GIFs..."
              autoFocus
            />
            <button
              onClick={() => {
                if (tempSearchTerm.trim() !== '') {
                  searchGifs(tempSearchTerm.trim());
                }
              }}
              disabled={!tempSearchTerm || isSearching}
              className="rounded-xl bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSearching ? '...' : '🔍'}
            </button>
          </div>

          {/* Debug status */}
          <div className="text-center text-xs text-gray-400">
            {isSearching
              ? 'Searching...'
              : gifUrls.length > 0
                ? `Found ${gifUrls.length} GIFs`
                : 'Enter a search term'}
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
              <div className="mt-2 text-center text-sm text-blue-400">Searching for GIFs...</div>
            </div>
          )}

          {/* Simplified GIF Display - uses the direct URLs */}
          {!isSearching && gifUrls.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              <div className="grid grid-cols-2 gap-2">
                {gifUrls.map((url, idx) => (
                  <div
                    key={`gif-${idx}`}
                    onClick={() => {
                      // Select the corresponding GIF from the gifs array
                      if (gifs[idx]) {
                        setSelectedGifInModal(gifs[idx]);
                      }
                    }}
                    className="cursor-pointer overflow-hidden rounded-lg border border-gray-700 hover:border-gray-500"
                  >
                    {/* Simplified image display */}
                    <div className="relative h-24 w-full bg-black">
                      <img
                        src={url}
                        alt={`GIF ${idx + 1}`}
                        className="h-full w-full object-cover"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>

                    {/* Simple caption */}
                    <div className="bg-gray-800 p-2 text-center">
                      <div className="truncate text-xs text-gray-300">
                        {gifs[idx]?.content_description || `GIF ${idx + 1}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No results state */}
          {!isSearching && gifUrls.length === 0 && tempSearchTerm && (
            <div className="py-4 text-center text-sm text-gray-400">
              No GIFs found. Try a different search term.
            </div>
          )}

          {/* Selected GIF Preview */}
          {selectedGifInModal && (
            <div className="mt-2 rounded-lg border border-blue-500 bg-gray-800 p-2">
              <div className="mb-1 text-center text-xs text-white">Selected GIF:</div>
              <div className="flex justify-center rounded bg-black p-1">
                <img
                  src={getGifUrl(selectedGifInModal)}
                  alt="Selected GIF"
                  className="h-24 object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <div className="relative mb-4 flex items-center">
        <button
          onClick={() => onNavigate('landing')}
          className="absolute left-0 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">←</span>
          <ChewyText size={0.5} color="white">
            Back
          </ChewyText>
        </button>
        <div className="flex w-full justify-center">
          <ChewyText size={1.2} color={colors.primary}>
            Create GIF Enigma
          </ChewyText>
        </div>
      </div>

      {/* Word/Phrase Toggle - Integrated in main layout */}
      <div className="mb-3 flex justify-center">
        <InputTypeToggle />
      </div>

      {/* Creator Form - Reduced gap for more compact layout */}
      <div className="flex flex-col gap-3">
        {/* Secret Word/Phrase Input - More Compact Layout */}
        <div className="mb-2">
          <div className="flex items-center gap-3">
            <div
              className="flex-grow rounded-full px-4 py-3"
              style={{ backgroundColor: colors.cardBackground }}
            >
              <ChewyText size={0.7} color={secretInput ? colors.textPrimary : colors.textSecondary}>
                {secretInput || `Click 'Set ${inputType}' to set the secret ${inputType} 👉`}
              </ChewyText>
            </div>
            <button
              onClick={handleSetSecretInput}
              className="cursor-pointer rounded-full border-none px-4 py-2.5 transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: colors.primary }}
            >
              <ChewyText size={0.6} color="white">
                Set {inputType}
              </ChewyText>
            </button>
          </div>
          <ChewyText size={0.6} color={colors.textSecondary} className="mt-1.5">
            Players will guess this {inputType} (min.{' '}
            {inputType === 'word' ? '5 letters' : '2 words'})
          </ChewyText>
        </div>

        {/* Post to Subreddit Toggle - Integrated into secret word row */}
        <div className="mb-1 flex justify-start">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer" onClick={togglePostToSubreddit}>
              <ChewyText size={0.7} color={colors.textSecondary}>
                Post to r/PlayGIFEnigma
              </ChewyText>
            </label>
            <div
              className={`relative h-5 w-10 rounded-full transition-colors duration-200 ${
                postToSubreddit ? 'bg-green-500' : 'bg-gray-700'
              }`}
              onClick={togglePostToSubreddit}
              style={{ cursor: 'pointer' }}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-200 ${
                  postToSubreddit ? 'left-5' : 'left-0.5'
                }`}
              />
            </div>
          </div>
        </div>

        {/* GIF Selection Grid with Add Buttons */}
        {renderGifGrid()}

        {/* Submit button - FIXED so it only shows "Creating..." when isCreating is true */}
        <button
          onClick={submitGame}
          disabled={
            isCreating || !secretInput || selectedGifs.filter((g) => g !== null).length !== 4
          }
          className={`mt-2 cursor-pointer rounded-xl border-none px-4 py-3 transition-all duration-300 ${
            isCreating || !secretInput || selectedGifs.filter((g) => g !== null).length !== 4
              ? 'cursor-not-allowed opacity-60'
              : 'hover:-translate-y-1 hover:scale-105 hover:shadow-lg active:scale-95'
          }`}
          style={{ backgroundColor: colors.primary }}
        >
          <ChewyText size={0.8} color="white">
            {isCreating ? '🔄 Creating...' : '🎮 Create GIF Enigma'}
          </ChewyText>
        </button>
      </div>
    </div>
  );
};
