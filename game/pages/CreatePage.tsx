import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';
import { Modal } from '../components/Modal';
import { CategoryType } from './CategoryPage';
import { NavigationProps, Page } from '../lib/types';
import * as transitions from '../../src/utils/transitions';

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
  return gif?.url || '';
};

export interface CreatePageProps extends NavigationProps {
  context: any;
  category?: CategoryType;
  onNavigate: (page: Page) => void;
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

  // @ts-ignore
  const [message, setMessage] = useState<string>('');
  // @ts-ignore
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  // const [uploadedGifUrls, setUploadedGifUrls] = useState<{ [gifId: string]: string }>({});
  const [isPageLoaded, setIsPageLoaded] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Add refs for elements to animate
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const gifGridRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const disableSecretChange = selectedGifs.filter((g) => g !== null).length > 0;

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

  // Update your getNextRecommendation function to animate both the secret word and the hints
  const getNextRecommendation = () => {
    const secretElement = document.querySelector('.secret-word-container');
    const hintElements = document.querySelectorAll('.hint-text');

    // Add fade out transition to secret word and hints
    if (secretElement) {
      secretElement.classList.add('opacity-0', 'translate-y-2');
    }

    hintElements.forEach((element) => {
      (element as HTMLElement).classList.add('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
      // Update content
      const nextIndex = (currentRecIndex + 1) % recommendations.length;
      setCurrentRecIndex(nextIndex);
      setSecretInput(recommendations[nextIndex]);
      fetchSynonyms(recommendations[nextIndex]);

      // Fade back in after a short delay to ensure state has updated
      setTimeout(() => {
        if (secretElement) {
          secretElement.classList.remove('opacity-0', 'translate-y-2');
        }

        // Fade in hints with a slight delay for staggered effect
        hintElements.forEach((element, index) => {
          setTimeout(() => {
            (element as HTMLElement).classList.remove('opacity-0', 'translate-y-2');
          }, index * 50);
        });
      }, 50);
    }, 300);
  };

  useEffect(() => {
    // Animation setup
    setIsPageLoaded(true);

    if (titleRef.current) {
      transitions.animateElement(titleRef.current, {
        duration: 500,
        delay: 150,
        direction: 'up',
      });
    }

    // Animate header elements
    if (headerRef.current) {
      transitions.fadeIn(headerRef.current, {
        duration: 400,
        direction: 'up',
        distance: 'sm',
      });
    }

    // Animate main content with delay
    if (mainContentRef.current) {
      transitions.animateElement(mainContentRef.current, {
        duration: 500,
        delay: 200,
        direction: 'up',
      });
    }

    // Animate GIF grid with longer delay
    if (gifGridRef.current) {
      transitions.animateElement(gifGridRef.current, {
        duration: 500,
        delay: 400,
        direction: 'up',
      });
    }

    // Animate submit button last
    if (submitButtonRef.current) {
      transitions.animateElement(submitButtonRef.current, {
        duration: 500,
        delay: 600,
        direction: 'up',
      });
    }
    const handleMessage = (event: MessageEvent) => {
      let msg = event.data;
      if (msg?.type === 'devvit-message' && msg.data?.message) {
        msg = msg.data.message;
      }
      if (!msg || typeof msg !== 'object') return;

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

      if (msg.type === 'SEARCH_TENOR_GIFS_RESULT') {
        setIsSearching(false);
        if (msg.success && Array.isArray(msg.results)) {
          setGifs(msg.results);
          // msg.results.forEach((gif: TenorGifResult) => {
          //   window.parent.postMessage(
          //     {
          //       type: 'UPLOAD_TENOR_GIF',
          //       data: { tenorGifUrl: getGifUrl(gif), gifId: gif.id },
          //     },
          //     '*'
          //   );
          // });
        } else {
          setGifs([]);
        }
      }

      // if (msg.type === 'UPLOAD_TENOR_GIF_RESULT') {
      //   if (msg.success && msg.mediaUrl && msg.gifId) {
      //     setUploadedGifUrls((prev) => ({ ...prev, [msg.gifId]: msg.mediaUrl }));
      //   } else {
      //     console.error(`Failed to upload GIF ${msg.gifId}: ${msg.error}`);
      //   }
      // }

      if (msg.type === 'SAVE_GAME_RESULT') {
        setIsCreating(false);
        if (msg.success && msg.result && msg.result.success) {
          setShowSuccessModal(true);
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

  // const uploadGif = (gif: TenorGifResult) => {
  //   const gifUrl = getGifUrl(gif);
  //   if (!gifUrl) {
  //     setMessage('Unable to load this GIF. Please try another one.');
  //     setMessageType('error');
  //     return;
  //   }
  //   window.parent.postMessage(
  //     {
  //       type: 'UPLOAD_TENOR_GIF',
  //       data: { tenorGifUrl: gifUrl },
  //     },
  //     '*'
  //   );
  // };

  // Back button click handler
  const handleBackClick = () => {
    // Fade out elements before navigating
    if (headerRef.current) {
      transitions.fadeOut(headerRef.current, { duration: 300 });
    }
    if (mainContentRef.current) {
      transitions.fadeOut(mainContentRef.current, { duration: 300, delay: 100 });
    }

    // Navigate after animations
    setTimeout(() => {
      onNavigate('category');
    }, 400);
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
    <div className="mb-4" ref={gifGridRef}>
      <div className="mb-2 flex items-center justify-between">
        <ComicText size={0.8} color={colors.primary}>
          GIF Clues
        </ComicText>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, index) => {
          const gif = selectedGifs[index];
          const defaultSynonym = synonyms[index]?.[0] || '';
          const boxNumber = index + 1;

          return (
            <div
              key={index}
              className={`gif-slot-${index} relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-500 transition-all duration-300 sm:h-32 sm:w-48 md:h-56 md:w-56 lg:h-60 lg:w-60 xl:h-64 xl:w-64 2xl:h-64 2xl:w-64`}
              style={{
                border: gif ? 'none' : `3px solid ${colors.secondary}`,
              }}
            >
              {/* Number indicator */}
              <div className="bg-opacity-70 absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                <ComicText size={0.5} color="white">
                  #{boxNumber}
                </ComicText>
              </div>

              {gif ? (
                <div className="relative h-full w-full">
                  <button
                    onClick={() => removeGifFromSlot(index)}
                    className="absolute top-2 right-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all duration-200 hover:scale-110"
                  >
                    ✕
                  </button>
                  <img
                    src={getGifUrl(gif)}
                    alt={`GIF ${index + 1}`}
                    className="h-full w-full object-cover transition-opacity duration-500"
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
                  <div className="mb-1 text-2xl transition-transform duration-300 hover:rotate-12">
                    ➕
                  </div>
                  <div className="transition-all duration-300">
                    <ComicText size={0.6} color={colors.textSecondary}>
                      {defaultSynonym ? (
                        <span className="hint-text transition-all duration-300 ease-in-out">
                          Hint: <span className="text-yellow-400">{defaultSynonym}</span>
                        </span>
                      ) : (
                        `Add GIF #${index + 1}`
                      )}
                    </ComicText>
                  </div>
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
          position: 'relative',
          minHeight: '40px',
        }}
      >
        <div
          className="absolute h-full w-1/2 rounded-full transition-all duration-300 ease-in-out"
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
    <div
      className="flex min-h-screen flex-col items-center p-5 transition-opacity duration-500"
      style={{ opacity: isPageLoaded ? 1 : 0 }}
    >
      <Modal
        title="Select GIF of your choice"
        isOpen={showSearchInput}
        onClose={() => {
          transitions.fadeOut(document.querySelector('.modal-content'), {
            duration: 300,
            onComplete: () => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              setShowSearchInput(false);
              setIsSearching(false);
            },
          });
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setShowSearchInput(false);
          setIsSearching(false);
          setSelectedGifInModal(null);
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
                  // const url = uploadedGifUrls[gif.id] || getGifUrl(gif);
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
                      }`}
                    >
                      <div className="relative h-24 w-full bg-black">
                        <img
                          src={url}
                          alt={gif.content_description || `GIF ${idx + 1}`}
                          className="w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const container = e.currentTarget.closest('.gif-container');
                            if (container) container.remove();
                            // e.currentTarget.parentElement?.parentElement?.remove();
                            const fallback = document.createElement('div');
                            fallback.className = 'gif-fallback';
                            fallback.textContent = '🎬 GIF not available';
                            e.currentTarget.parentNode?.appendChild(fallback);
                          }}
                          onLoad={(e) => {
                            // Optional: Add fade-in animation
                            e.currentTarget.style.opacity = '1';
                          }}
                          style={{ opacity: 0, transition: 'opacity 0.3s' }}
                        />
                      </div>
                      {/* <div className="bg-gray-800 p-2 text-center">
                        <div className="truncate text-xs text-gray-300">
                          {gif.content_description || gif.title || `GIF ${idx + 1}`}
                        </div>
                      </div> */}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {selectedGifInModal && (
            <div className="mt-2 rounded-lg border border-blue-500 bg-gray-800 p-2">
              <ComicText size={0.6} color="#fff" className="mb-1 text-center">
                Selected GIF:
              </ComicText>
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

      {/* Header */}
      <header
        ref={headerRef}
        className="optacity-0 mb-5 flex w-full max-w-4xl items-center justify-between"
      >
        <button
          onClick={handleBackClick}
          className="left-4 flex cursor-pointer items-center rounded-full border-none px-3 py-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <span className="mr-1 text-sm text-white">👈</span>
          <ComicText size={0.5} color="white">
            Back
          </ComicText>
        </button>
        <div className="flex w-full flex-col items-center justify-center pr-8 md:pr-12 lg:pr-20">
          <div
            ref={titleRef}
            className="translate-y-4 transform opacity-0 transition-all duration-500"
          >
            <ComicText size={1.2} color={colors.primary}>
              Create GIF Enigma
            </ComicText>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainContentRef} className="optacity-0 flex flex-1 flex-col items-center px-4">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center">
          {/* Row 1: Category and Word/Phrase toggle */}
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-1">
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
              <ComicText size={0.6} color={colors.textPrimary}>
                Category: <span style={{ fontWeight: 'bold' }}>{currentCategory}</span>
              </ComicText>
            </div>
            <div className="group relative">
              <div className={disableSecretChange ? 'pointer-events-none opacity-60' : ''}>
                <InputTypeToggle />
              </div>
              {disableSecretChange && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  Clear GIFs to change word/phrase
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="secret-word-container transition-all duration-300">
              {secretInput ? (
                <ComicText size={0.7} color={colors.primary}>
                  <span className="inline-block transition-all duration-300" key={inputType}>
                    Secret {inputType === 'word' ? 'Word' : 'Phrase'}:
                  </span>{' '}
                  <span style={{ color: 'yellow', fontWeight: 'bold' }}>
                    {secretInput.toUpperCase()}
                  </span>
                </ComicText>
              ) : (
                <ComicText size={0.6} color={colors.textSecondary}>
                  Loading...
                </ComicText>
              )}
            </div>
          </div>
          <div className="group items-left relative justify-center">
            <button
              onClick={getNextRecommendation}
              disabled={disableSecretChange}
              className={`rounded-full px-3 py-1 text-white transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg ${
                disableSecretChange ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              style={{ backgroundColor: colors.secondary }}
            >
              <ComicText size={0.6} color="#fff">
                Try a different one
              </ComicText>
            </button>
            {disableSecretChange && (
              <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                Clear GIFs to pick another word/phrase
              </div>
            )}
          </div>

          {renderGifGrid()}

          {/* Success Modal */}
          {showSuccessModal && (
            <div className="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm transition-all duration-300">
              <div className="animate-bounce-slow rounded-xl bg-gray-800 p-6 shadow-lg">
                <div className="mb-4 text-4xl">🎉</div>
                <ComicText size={1} color={colors.primary} className="mb-2 text-center">
                  Game Created Successfully!
                </ComicText>
                <ComicText size={0.7} color="white" className="mb-4 text-center">
                  Your GIF Enigma is ready to play!
                </ComicText>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => {
                      // First close the modal
                      setShowSuccessModal(false);

                      // Then fade out page elements
                      if (headerRef.current) {
                        transitions.fadeOut(headerRef.current, { duration: 300 });
                      }
                      if (mainContentRef.current) {
                        transitions.fadeOut(mainContentRef.current, { duration: 300 });
                      }

                      // Navigate after a consistent delay
                      setTimeout(() => {
                        onNavigate('landing');
                      }, 400);
                    }}
                    className="cursor-pointer rounded-xl px-4 py-2 transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <ComicText size={0.7} color="white">
                      Back to Home
                    </ComicText>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <button
              ref={submitButtonRef}
              onClick={submitGame}
              disabled={selectedGifs.filter((g) => g !== null).length !== 4}
              className={`cursor-pointer rounded-xl border-none px-4 py-2 transition-all duration-300 ${
                selectedGifs.filter((g) => g !== null).length !== 4
                  ? 'bg-gray-500 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'bg-[#FF4500] hover:-translate-y-1 hover:scale-105 hover:shadow-lg active:scale-95'
              }`}
              style={{
                backgroundColor:
                  selectedGifs.filter((g) => g !== null).length === 4 ? colors.primary : '#6B7280',
              }}
            >
              <ComicText size={0.8} color="white">
                {isCreating ? '🔄 Creating...' : '🎮 Create GIF Enigma'}
              </ComicText>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
