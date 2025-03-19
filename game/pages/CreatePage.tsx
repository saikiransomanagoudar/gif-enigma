import React, { useState, useEffect } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { NavigationProps } from '../App';
import { Modal } from '../components/Modal';

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

  const availableFormats = Object.keys(gif.media_formats);
  console.log('Available formats:', availableFormats);

  const preferredFormats = ['gif', 'tinygif', 'mediumgif', 'nanogif'];

  for (const format of preferredFormats) {
    const formatObj = gif.media_formats[format];
    if (formatObj && formatObj.url) {
      console.log(`Using ${format} URL:`, formatObj.url);
      return formatObj.url;
    }
  }

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

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  // @ts-ignore
  const [message, setMessage] = useState<string>('');

  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Modal states
  const [showSecretInput, setShowSecretInput] = useState<boolean>(false);
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // @ts-ignore
  const [shake, setShake] = useState<boolean>(false);

  useEffect(() => {
    console.log('[DEBUG] CreatePage component mounted/updated');
    console.log('[DEBUG] Modal open state:', showSearchInput);
  }, [showSearchInput]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let message = event.data;

      if (message?.type === 'devvit-message' && message.data?.message) {
        message = message.data.message;
      }
      console.log('[DEBUG] Unwrapped message:', message);

      if (!message || typeof message !== 'object') return;

      console.log('Received message:', message.type);

      // Clear any timeout first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Handle GIF search results
      if (message.type === 'SEARCH_TENOR_GIFS_RESULT' || message.type === 'SEARCH_GIFS_RESULT') {
        setIsSearching(false);
        console.log('Search complete, setting isSearching=false', message);

        try {
          if (message.success && message.results && Array.isArray(message.results)) {
            // Log the entire first result to inspect structure
            const firstResult = message.results[0];
            console.log('Complete first result:', JSON.stringify(firstResult));

            // Test URL extraction immediately
            if (firstResult) {
              const formats = Object.keys(firstResult.media_formats || {});
              console.log('Available formats:', formats);

              formats.forEach((format) => {
                const formatData = firstResult.media_formats[format];
                if (formatData) {
                  console.log(`Format ${format} URL:`, formatData.url);
                }
              });
            }

            setGifs(message.results);
          } else {
            console.log('No results or search failed', message);
            setGifs([]);
          }
        } catch (error) {
          console.error('Error processing search results:', error);
          setGifs([]);
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
  }, []);

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
    if (inputType === 'word' && tempSecretInput.includes(' ')) {
      setModalError('Please select phrase mode for phrases');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (validateSecretInput(tempSecretInput)) {
      setSecretInput(tempSecretInput.trim().toUpperCase());
      setShowSecretInput(false);
      setModalError('');
    } else {
      setModalError(
        inputType === 'word'
          ? 'Input must be 5 characters long'
          : 'Input must be 5 characters incl. spaces'
      );
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleSetSearchTerm = (index: number) => {
    setSelectedGifIndex(index);
    setShowSearchInput(true);
    setTempSearchTerm('');
    setGifs([]);
    setMessage('');
    setMessageType('info');
  };

  useEffect(() => {
    console.log('gifs updated:', gifs);
  }, [gifs]);

  useEffect(() => {
    console.log('isSearching updated:', isSearching);
  }, [isSearching]);

  const searchGifs = async (term: string) => {
    if (!term) return;

    setGifs([]);
    setIsSearching(true);
    setSelectedGifInModal(null);

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

      timeoutRef.current = setTimeout(() => {
        console.log('Search timed out after 8 seconds');
        setIsSearching(false);
        setMessage('Search timed out. Please try again.');
        setMessageType('error');
      }, 8000);
    } catch (error) {
      console.error('Error initiating search:', error);
      setIsSearching(false);
      setMessage('Error starting search. Please try again.');
      setMessageType('error');
    }
  };

  const selectGifForSlot = (gif: TenorGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      const gifUrl = getGifUrl(gif);
      console.log(`Selecting GIF ${gif.id} with URL: ${gifUrl}`);

      if (!gifUrl) {
        console.log('No valid URL found for GIF');
        setMessage('Unable to load this GIF. Please try another one.');
        setMessageType('error');
        return;
      }

      const cleanGif = JSON.parse(JSON.stringify(gif));

      const newSelectedGifs = [...selectedGifs];
      newSelectedGifs[selectedGifIndex] = cleanGif;

      setSelectedGifs(newSelectedGifs);
      setShowSearchInput(false);
      setSelectedGifInModal(null);
      setGifs([]);
      setMessage('GIF selected successfully!');
      setMessageType('success');
    }
  };

  const removeGifFromSlot = (index: number) => {
    const newSelectedGifs = [...selectedGifs];
    newSelectedGifs[index] = null;
    setSelectedGifs(newSelectedGifs);
  };

  // const togglePostToSubreddit = () => {
  //   setPostToSubreddit(!postToSubreddit);
  // };

  // const toggleInputType = () => {
  //   setInputType(inputType === 'word' ? 'phrase' : 'word');
  //   // Clear the current input when switching types
  //   setSecretInput('');
  // };

  const submitGame = () => {
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

    setIsCreating(true);
    setMessage('Creating your GIF Enigma game...');
    setMessageType('info');

    try {
      // Process the secret input to create a masked version
      const wordArray = secretInput.split('');
      const maskCount = Math.floor((wordArray.length * 2) / 3);
      const indicesToMask = new Set<number>();

      while (indicesToMask.size < maskCount) {
        indicesToMask.add(Math.floor(Math.random() * wordArray.length));
      }

      const maskedWord = wordArray
        .map((char, index) => (indicesToMask.has(index) ? (char === ' ' ? ' ' : '_') : char))
        .join('');

      const questionText =
        inputType === 'word'
          ? 'Can you guess the word from these GIF clues?'
          : 'Can you guess the phrase from these GIF clues?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      window.parent.postMessage(
        {
          type: 'SAVE_GAME',
          data: {
            word: secretInput,
            maskedWord,
            questionText,
            gifs: gifUrls,
          },
        },
        '*'
      );
    } catch (error) {
      setIsCreating(false);
      setMessage(
        `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessageType('error');
    }
  };

  const renderGifGrid = () => (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <ComicText size={0.8} color={colors.textPrimary}>
          GIF Clues
        </ComicText>
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
                border: gif ? 'none' : `3px solid ${colors.secondary}`,
                transition: 'all 0.3s ease-in-out',
              }}
            >
              {gif ? (
                <div className="relative h-full w-full">
                  <div
                    className={`absolute inset-0 flex h-full w-full items-center justify-center p-3 text-center transition-all duration-300 ${'bg-opacity-0'}`}
                  >
                    <ComicText size={0.6} color={colors.textSecondary}>
                      {gif.content_description || `GIF ${index + 1}`}
                    </ComicText>
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
                  <ComicText size={0.6} color={colors.textSecondary}>
                    Add GIF #{index + 1}
                  </ComicText>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const InputTypeToggle = () => (
    <div className="flex items-center justify-center">
      <div
        className="relative flex h-10 items-center overflow-hidden rounded-full"
        style={{
          backgroundColor: '#2D3748',
          border: `2px solid ${colors.primary}`,
          width: '160px',
        }}
      >
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
          <ComicText size={0.6} color={inputType === 'word' ? 'white' : colors.textSecondary}>
            Word
          </ComicText>
        </button>
        <button
          onClick={() => setInputType('phrase')}
          className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center transition-all duration-200"
        >
          <ComicText size={0.6} color={inputType === 'phrase' ? 'white' : colors.textSecondary}>
            Phrase
          </ComicText>
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <Modal
        title={`Enter Secret ${inputType === 'word' ? 'Word' : 'Phrase'}`}
        isOpen={showSecretInput}
        onClose={() => {
          setShowSecretInput(false);
          setModalError('');
        }}
        onConfirm={confirmSecretInput}
        shake={shake}
      >
        <div className="flex flex-col gap-3">
          <div>
            <ComicText size={0.6} color={colors.textSecondary}>
              {inputType === 'word'
                ? 'Enter a word with at least 5 letters.'
                : 'Enter a phrase with at least 2 words.'}
            </ComicText>
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
              <ComicText size={0.6} color="red">
                {modalError}
              </ComicText>
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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempSearchTerm}
              onChange={(e) => {
                setTempSearchTerm(e.target.value);
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter' && tempSearchTerm.trim() !== '') {
                  searchGifs(tempSearchTerm.trim());
                }
              }}
              className="flex-grow rounded-xl border-2 border-gray-700 bg-gray-800 p-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Search GIFs..."
              autoFocus
            />
            <button
              onClick={() => {
                if (tempSearchTerm.trim() !== '') {
                  searchGifs(tempSearchTerm.trim());
                }
              }}
              disabled={!tempSearchTerm || isSearching}
              className="cursor-pointer rounded-xl bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSearching ? '...' : '🔍'}
            </button>
          </div>

          {isSearching && (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
              <div className="mt-2 text-center text-sm text-blue-400">Searching for GIFs...</div>
            </div>
          )}

          {!isSearching && gifs.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              <>{console.log('Rendering GIF grid with', gifs.length, 'gifs')}</>
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => {
                  const url = getGifUrl(gif);
                  if (!url) {
                    console.log(`No URL found for GIF ${idx}`);
                    return null;
                  }
                  return (
                    <div
                      key={`gif-${idx}-${gif.id}`}
                      onClick={() => setSelectedGifInModal(gif)}
                      className={`cursor-pointer overflow-hidden rounded-lg border ${
                        selectedGifInModal?.id === gif.id
                          ? 'border-blue-500'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="relative h-24 w-full bg-black">
                        <img
                          src={getGifUrl(selectedGifInModal)}
                          alt="Selected GIF"
                          width={250}
                          height={250}
                          style={{ objectFit: 'contain' }}
                          onError={(e) => {
                            e.currentTarget.src = '/create-page/fallback.gif';
                          }}
                        />
                      </div>
                      <div className="bg-gray-800 p-2 text-center">
                        <div className="truncate text-xs text-gray-300">
                          {gif.content_description || gif.title || `GIF ${idx + 1}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedGifInModal && (
            <div className="mt-2 rounded-lg border border-blue-500 bg-gray-800 p-2">
              <div className="mb-1 text-center text-xs text-white">Selected GIF:</div>
              <div className="flex justify-center rounded bg-black p-1">
                <img
                  src={getGifUrl(selectedGifInModal)}
                  alt="Selected GIF"
                  className="h-24 object-contain"
                  onError={(e) => {
                    console.error(`Failed to load selected GIF preview`);
                    e.currentTarget.src = 'https://via.placeholder.com/150?text=GIF+Error'; // Fallback image
                  }}
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
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full justify-center">
          <ComicText size={1.2} color={colors.primary}>
            Create GIF Enigma
          </ComicText>
        </div>
      </div>

      <div className="mb-3 flex justify-center">
        <InputTypeToggle />
      </div>

      <div className="flex flex-col gap-3">
        <div className="mb-2">
          <div className="flex items-center gap-3">
            <div
              className="flex-grow rounded-full px-4 py-3"
              style={{ backgroundColor: colors.cardBackground }}
            >
              <ComicText size={0.7} color={secretInput ? colors.textPrimary : colors.textSecondary}>
                {secretInput || `Click 'Set ${inputType}' to set the secret ${inputType} 👉`}
              </ComicText>
            </div>
            <button
              onClick={handleSetSecretInput}
              className="cursor-pointer rounded-full border-none px-4 py-2.5 transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: colors.primary }}
            >
              <ComicText size={0.6} color="white">
                Set {inputType}
              </ComicText>
            </button>
            {secretInput && (
              <button
                onClick={() => setSecretInput('')}
                className="cursor-pointer rounded-full border-none px-4 py-2.5 transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: colors.error }}
              >
                <ComicText size={0.6} color="white">
                  Clear
                </ComicText>
              </button>
            )}
          </div>
          <ComicText size={0.6} color={colors.textSecondary} className="mt-1.5">
            Players will guess this {inputType} (min.{' '}
            {inputType === 'word' ? '5 characters' : '5 characters incl. spaces'})
          </ComicText>
        </div>

        {/* <div className="mb-1 flex justify-start">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer" onClick={togglePostToSubreddit}>
              <ComicText size={0.7} color={colors.textSecondary}>
                Post to r/PlayGIFEnigma
              </ComicText>
            </label>
            <div
              className={`relative h-5 w-10 rounded-full transition-colors duration-200 ${'bg-green-500'}`}
              style={{ cursor: 'pointer' }}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-200 ${'left-5'}`}
              />
            </div>
          </div>
        </div> */}

        {renderGifGrid()}

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
          <ComicText size={0.8} color="white">
            {isCreating ? '🔄 Creating...' : '🎮 Create GIF Enigma'}
          </ComicText>
        </button>
      </div>
    </div>
  );
};
