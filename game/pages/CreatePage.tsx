import React, { useState, useEffect } from 'react';
import { colors } from '../lib/styles';
import { ChewyText } from '../lib/fonts'; // <-- Renamed from ComicText
import { NavigationProps } from '../App';
import { Modal } from '../components/Modal';
import { CategoryType } from './CategoryPage';

// We'll still use this interface
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
  if (!gif || !gif.media_formats) {
    return '';
  }

  // Prefer these formats in order
  const preferredFormats = ['gif', 'tinygif', 'mediumgif', 'nanogif'];

  for (const format of preferredFormats) {
    const formatObj = gif.media_formats[format];
    if (formatObj && formatObj.url) {
      return formatObj.url;
    }
  }

  // Fallback to any available format
  const availableFormats = Object.keys(gif.media_formats);
  for (const format of availableFormats) {
    const formatObj = gif.media_formats[format];
    if (formatObj && formatObj.url) {
      return formatObj.url;
    }
  }

  return '';
};

export interface CreatePageProps extends NavigationProps {
  context: any;
  category?: CategoryType;
}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate, category = 'General' }) => {
  // Word/phrase & category
  const [inputType, setInputType] = useState<'word' | 'phrase'>('word');
  const [currentCategory, setCurrentCategory] = useState<CategoryType>(category);

  // Recommendation states
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [currentRecIndex, setCurrentRecIndex] = useState<number>(0);
  const [secretInput, setSecretInput] = useState<string>('');

  // Synonyms for progressive hints
  const [synonyms, setSynonyms] = useState<string[][]>([]);

  // GIF states
  // @ts-ignore
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<TenorGifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<(TenorGifResult | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);
  const [selectedGifInModal, setSelectedGifInModal] = useState<TenorGifResult | null>(null);

  // UI states
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (category) {
      setCurrentCategory(category);
    }
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCategory, inputType]);

  const fetchRecommendations = async () => {
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_RECOMMENDATIONS',
        data: {
          category: currentCategory,
          inputType: inputType,
          count: 10,
        },
      },
      '*'
    );
  };

  const fetchSynonyms = async (word: string) => {
    window.parent.postMessage(
      {
        type: 'GET_GEMINI_SYNONYMS',
        data: { word },
      },
      '*'
    );
  };

  // Cycle to the next recommendation (up to 10 tries)
  const getNextRecommendation = () => {
    const nextIndex = (currentRecIndex + 1) % recommendations.length;
    setCurrentRecIndex(nextIndex);
    setSecretInput(recommendations[nextIndex]);
    fetchSynonyms(recommendations[nextIndex]);
  };

  // Listen for postMessage events from server or devvit
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      }
      if (!msg || typeof msg !== 'object') return;

      // Clear any existing search timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (msg.type === 'GET_GEMINI_RECOMMENDATIONS_RESULT') {
        if (msg.success && Array.isArray(msg.result)) {
          const filtered = msg.result.filter((r: string) => r.length >= 5);
          setRecommendations(filtered);
          setCurrentRecIndex(0);
          if (filtered.length > 0) {
            setSecretInput(filtered[0]);
            // fetch synonyms for the first recommendation
            fetchSynonyms(filtered[0]);
          }
        } else {
          console.error('Gemini recs error:', msg.error);
          setRecommendations([]);
          setSecretInput('');
        }
      }
      
      if (msg.type === 'GET_GEMINI_SYNONYMS_RESULT') {
        if (msg.success && Array.isArray(msg.result)) {
          setSynonyms(msg.result);
        } else {
          console.error('Gemini synonyms error:', msg.error);
          setSynonyms([]);
        }
      }
      

      // GIF search results
      if (msg.type === 'SEARCH_TENOR_GIFS_RESULT' || msg.type === 'SEARCH_GIFS_RESULT') {
        setIsSearching(false);
        if (msg.success && msg.results && Array.isArray(msg.results)) {
          setGifs(msg.results);
        } else {
          setGifs([]);
        }
      }

      // Game creation result
      if (msg.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);
        if (msg.success && msg.result && msg.result.success) {
          const result = msg.result;
          const successMessage = result.postedToReddit
            ? `Game created and posted to r/PlayGIFEnigma! Game ID: ${result.gameId}`
            : `Game created successfully! Game ID: ${result.gameId}`;
          setMessage(successMessage);
          setMessageType('success');
          // Reset
          setSecretInput('');
          setSelectedGifs([null, null, null, null]);
          setGifs([]);
          setSearchTerm('');
        } else {
          setMessage(`Failed to create game: ${msg.error || msg.result?.error || 'Unknown error'}`);
          setMessageType('error');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle Tenor GIF search
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
      window.parent.postMessage(
        {
          type: 'SEARCH_TENOR_GIFS',
          data: { query: term, limit: 8 },
        },
        '*'
      );
      timeoutRef.current = setTimeout(() => {
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

  // Select a GIF for a slot
  const selectGifForSlot = (gif: TenorGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      const gifUrl = getGifUrl(gif);
      if (!gifUrl) {
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

  const submitGame = () => {
    const validGifs = selectedGifs.filter((gif) => gif !== null);
    if (!secretInput) {
      setMessage(`No valid recommended ${inputType} selected yet.`);
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
      const wordArray = secretInput.split('');
      const maskCount = Math.floor((wordArray.length * 2) / 3);
      const indicesToMask = new Set<number>();
      while (indicesToMask.size < maskCount) {
        indicesToMask.add(Math.floor(Math.random() * wordArray.length));
      }
      const maskedWord = wordArray
        .map((char, i) => (indicesToMask.has(i) && char !== ' ' ? '_' : char))
        .join('');

      const questionText =
        inputType === 'word'
          ? 'Can you guess the word from these GIF clues?'
          : 'Can you guess the phrase from these GIF clues?';

      const gifUrls = validGifs.map((gif) => getGifUrl(gif));
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      // Post message to parent
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
        <ChewyText size={0.8} color={colors.textPrimary}>
          GIF Clues
        </ChewyText>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, index) => {
          const gif = selectedGifs[index];
          // Use the first synonym from the Gemini API results for default search
          const defaultSynonym = synonyms[index]?.[0] || '';

          return (
            <div
              key={index}
              className="relative flex items-center justify-center overflow-hidden rounded-xl transition-all duration-300 w-40 h-40 sm:w-48 sm:h-24 md:w-56 md:h-56 lg:w-60 lg:h-60 xl:w-64 xl:h-64 2xl:w-64 2xl:h-64 border-2 border-gray-500 bg-gray-800"
              style={{
                backgroundColor: colors.cardBackground,
                border: gif ? 'none' : `3px solid ${colors.secondary}`,
              }}
            >
              {gif ? (
                <div className="relative h-full w-full">
                  <button
                    onClick={() => removeGifFromSlot(index)}
                    className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all duration-200 hover:scale-110"
                  >
                    ✕
                  </button>
                  <img
                    src={getGifUrl(gif)}
                    alt={`GIF ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedGifIndex(index);
                    setShowSearchInput(true);
                    setSearchTerm(defaultSynonym);
                    setMessage('');
                    setMessageType('info');
                    searchGifs(defaultSynonym);
                  }}
                  className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-2 text-center transition-all duration-200 hover:scale-105"
                >
                  <div className="mb-1 text-2xl">➕</div>
                  <ChewyText size={0.6} color={colors.textSecondary}>
                    {defaultSynonym ? `Hint: ${defaultSynonym}` : `Add GIF #${index + 1}`}
                  </ChewyText>
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
          className="absolute h-full w-1/2 rounded-full"
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

  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

  useEffect(() => {
    if (category) {
      setCurrentCategory(category);
    }
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCategory, inputType]);

  return (
    <div className="container mx-auto w-full px-2 sm:px-4 md:px-6 lg:px-8">
      <Modal
        title="Select GIF of your choice"
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
          }
        }}
      >
        <div className="flex flex-col gap-4">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
              <div className="mt-2 text-center text-sm text-blue-400">Searching for GIFs...</div>
            </div>
          )}

          {!isSearching && gifs.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2">
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => {
                  const url = getGifUrl(gif);
                  if (!url) return null;
                  return (
                    <div
                      key={`gif-${idx}-${gif.id}`}
                      onClick={() => setSelectedGifInModal(gif)}
                      className={`cursor-pointer overflow-hidden rounded-lg border ${
                        selectedGifInModal?.id === gif.id
                          ? 'border-blue-500'
                          : 'border-gray-700 hover:border-gray-500'
                      } `}
                    >
                      <div className="relative h-24 w-full bg-black">
                        <img
                          src={url}
                          alt={gif.content_description || `GIF ${idx + 1}`}
                          className="h-full w-full object-contain"
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
                    console.error('Failed to load selected GIF preview');
                    e.currentTarget.src = 'https://via.placeholder.com/150?text=GIF+Error';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <div className="mx-auto w-full p-4">
        <div className="relative mb-6 flex items-center">
          <button
            onClick={() => onNavigate('category')}
            className="absolute left-0 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <span className="mr-1 text-sm text-white">👈</span>
            <ChewyText size={0.5} color="white">
              Back
            </ChewyText>
          </button>
          <div className="flex w-full flex-col items-center justify-center">
            <ChewyText size={1.2} color={colors.primary}>
              Create GIF Enigma
            </ChewyText>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-col items-center">
          {/* Row 1: Category and Word/Phrase toggle */}
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-base">
                {currentCategory === 'Movies'
                  ? '🎬'
                  : currentCategory === 'Gaming'
                    ? '🎮'
                    : currentCategory === 'Books'
                      ? '📚'
                      : '🌐'}
              </span>
              <ChewyText size={0.6} color={colors.textPrimary}>
                Category: {currentCategory}
              </ChewyText>
            </div>
            <div className={disableSecretChange ? 'pointer-events-none opacity-60' : ''}>
              <InputTypeToggle />
            </div>
          </div>

          <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2">
            <div>
              {secretInput ? (
                <ChewyText size={0.7} color={colors.primary}>
                  Secret {inputType === 'word' ? 'Word' : 'Phrase'}: {secretInput.toUpperCase()}
                </ChewyText>
              ) : (
                <ChewyText size={0.6} color={colors.textSecondary}>
                  Loading...
                </ChewyText>
              )}
            </div>
            <button
              onClick={getNextRecommendation}
              disabled={disableSecretChange}
              className={`rounded-full px-3 py-1 text-white hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                disableSecretChange ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              style={{ backgroundColor: colors.secondary }}
            >
              <ChewyText size={0.6} color="#fff">
                Try a different one
              </ChewyText>
            </button>
          </div>

          {renderGifGrid()}

          {message && (
            <div
              className="mb-3 rounded-lg p-3"
              style={{
                backgroundColor:
                  messageType === 'success'
                    ? 'rgba(74, 222, 128, 0.2)'
                    : messageType === 'error'
                      ? 'rgba(248, 113, 113, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
                border: `1px solid ${
                  messageType === 'success'
                    ? 'rgb(74, 222, 128)'
                    : messageType === 'error'
                      ? 'rgb(248, 113, 113)'
                      : 'rgb(59, 130, 246)'
                }`,
              }}
            >
              <ChewyText
                size={0.7}
                color={
                  messageType === 'success'
                    ? 'rgb(74, 222, 128)'
                    : messageType === 'error'
                      ? 'rgb(248, 113, 113)'
                      : 'rgb(59, 130, 246)'
                }
              >
                {message}
              </ChewyText>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <button
              onClick={submitGame}
              disabled={
                isCreating || !secretInput || selectedGifs.filter((g) => g !== null).length !== 4
              }
              className={`rounded-xl border-none px-4 py-3 transition-all duration-300 ${
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
      </div>
    </div>
  );
};
