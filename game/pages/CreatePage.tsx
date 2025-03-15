import React, { useState, useEffect } from 'react';
import { colors } from '../lib/styles';
import { ChewyText } from '../lib/fonts';
import { NavigationProps } from '../App';

// Updated GIF interface for Tenor
export interface TenorGifResult {
  id: string;
  title: string;
  media_formats: {
    gif: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
    tinygif: {
      url: string;
      dims: number[];
      duration: number;
      preview: string;
      size: number;
    };
  };
  content_description: string;
  created: number;
  hasaudio: boolean;
  url: string;
}

export interface CreatePageProps extends NavigationProps {
  context: any;
}

export const CreatePage: React.FC<CreatePageProps> = ({ onNavigate, context }) => {
  // Core game data
  const [secretInput, setSecretInput] = useState<string>('');
  const [tempSecretInput, setTempSecretInput] = useState<string>('');
  const [inputType, setInputType] = useState<'word' | 'phrase'>('word');

  // GIF search/selection
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tempSearchTerm, setTempSearchTerm] = useState<string>('');
  const [gifs, setGifs] = useState<TenorGifResult[]>([]);
  const [selectedGifs, setSelectedGifs] = useState<(TenorGifResult | null)[]>([]);
  const [selectedGifIndex, setSelectedGifIndex] = useState<number | null>(null);

  // UI states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [postToSubreddit, setPostToSubreddit] = useState<boolean>(true);

  // Modal states
  const [showSecretInput, setShowSecretInput] = useState<boolean>(false);
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // Validate secret input
  const validateSecretInput = (input: string): boolean => {
    if (!input || input.trim() === '') return false;

    // Convert to uppercase and remove extra spaces
    const processedInput = input.trim().toUpperCase();

    if (inputType === 'word') {
      // Check minimum length for a word (5 characters)
      return processedInput.length >= 5;
    } else {
      // Check minimum words for a phrase (2 words)
      const words = processedInput.split(/\s+/);
      return words.length >= 2;
    }
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
      // Show validation message in modal
      if (inputType === 'word') {
        setModalError('Word must be at least 5 letters long.');
      } else {
        setModalError('Phrase must contain at least 2 words.');
      }
    }
  };

  // Handle search term input for a specific gif slot
  const handleSetSearchTerm = (index: number) => {
    setSelectedGifIndex(index);
    setShowSearchInput(true);
    setTempSearchTerm('');
    setGifs([]);
  };

  const confirmSearchInput = () => {
    if (tempSearchTerm && tempSearchTerm.trim() !== '') {
      setSearchTerm(tempSearchTerm.trim());
      searchGifs(tempSearchTerm.trim());
    } else {
      setShowSearchInput(false);
    }
  };

  // Search for GIFs using Tenor API
  const searchGifs = async (term: string) => {
    if (!term) return;
    setIsLoading(true);
    setMessage('Searching for GIFs...');
    setMessageType('info');

    try {
      // In a real implementation, you would call Tenor API here
      // For now, we'll use mock data to simulate the API response
      const mockTenorResults = generateMockTenorResults(term);
      setGifs(mockTenorResults);
      setMessage(`Found ${mockTenorResults.length} GIFs for "${term}"`);
      setMessageType('success');

      /* 
      // The following code would be used for the actual Tenor API implementation
      
      const apiKey = "YOUR_TENOR_API_KEY"; // Replace with your actual Tenor API key
      const limit = 8; // Number of GIFs to fetch
      
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(term)}&key=${apiKey}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Tenor API response not ok: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.results && Array.isArray(data.results)) {
        setGifs(data.results);
        setMessage(`Found ${data.results.length} GIFs for "${term}"`);
        setMessageType("success");
      } else {
        setMessage("No GIFs found. Try a different search term.");
        setMessageType("info");
      }
      */
    } catch (error) {
      console.error('Error searching GIFs:', error);
      setMessage(
        `Failed to search GIFs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to generate mock Tenor GIF results for testing
  const generateMockTenorResults = (query: string): TenorGifResult[] => {
    // Sample GIF URLs (using mock Tenor responses)
    const mockResults: TenorGifResult[] = [];

    for (let i = 0; i < 8; i++) {
      mockResults.push({
        id: `tenor-${i}-${Date.now()}`,
        title: `${query} GIF ${i + 1}`,
        media_formats: {
          gif: {
            url: `https://media.tenor.com/mock-gif-${i}.gif`,
            dims: [480, 320],
            duration: 0,
            preview: `https://media.tenor.com/mock-preview-${i}.gif`,
            size: 1024000,
          },
          tinygif: {
            url: `https://media.tenor.com/mock-tinygif-${i}.gif`,
            dims: [220, 150],
            duration: 0,
            preview: `https://media.tenor.com/mock-tinypreview-${i}.gif`,
            size: 256000,
          },
        },
        content_description: `${query} example ${i + 1}`,
        created: Date.now(),
        hasaudio: false,
        url: `https://tenor.com/view/mock-${i}`,
      });
    }

    return mockResults;
  };

  // Select a GIF for a specific slot
  const selectGifForSlot = (gif: TenorGifResult) => {
    if (selectedGifIndex !== null && selectedGifIndex >= 0 && selectedGifIndex < 4) {
      const newSelectedGifs = [...selectedGifs];
      newSelectedGifs[selectedGifIndex] = gif;
      setSelectedGifs(newSelectedGifs);
      setShowSearchInput(false);
      setGifs([]);
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

  // Toggle between word and phrase input types with playful animation
  const toggleInputType = () => {
    setInputType(inputType === 'word' ? 'phrase' : 'word');
    // Clear the current input when switching types
    setSecretInput('');
  };

  // Submit the created game
  const submitGame = async () => {
    // Count non-null selected GIFs
    const validGifs = selectedGifs.filter((gif) => gif !== null);

    if (!secretInput || validGifs.length !== 4) {
      setMessage(`Please complete all fields and select exactly 4 GIFs.`);
      setMessageType('error');
      return;
    }

    setIsLoading(true);
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

      const gifUrls = validGifs.map((gif) => gif.media_formats.gif.url);
      if (!gifUrls.every((url) => typeof url === 'string' && url.trim() !== '')) {
        throw new Error('One or more selected GIFs have invalid URLs');
      }

      const result = await context.rpc.call('saveGameRPC', {
        word: secretInput, // Already uppercase from validation
        maskedWord,
        questionText,
        gifs: gifUrls,
        postToSubreddit,
      });

      if (result && result.success) {
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
        throw new Error(result?.error || 'Failed to save game');
      }
    } catch (error) {
      setMessage(
        `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessageType('error');
    } finally {
      setIsLoading(false);
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
          className="rounded-full cursor-pointer px-3 py-1 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
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
                  className="flex cursor-pointer h-full w-full flex-col items-center justify-center rounded-xl p-4 transition-all duration-200 hover:scale-105"
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

  // Compact Modal Component with fun styling
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
        className="relative flex h-10 items-center rounded-full overflow-hidden"
        style={{ 
          backgroundColor: '#2D3748', // Darker background
          border: `2px solid ${colors.primary}`,
          width: '160px'
        }}
      >
        {/* Sliding background - make it fill exactly half the container */}
        <div
          className="absolute h-full w-1/2 rounded-full transition-all duration-300 ease-bounce"
          style={{
            backgroundColor: colors.primary,
            left: inputType === 'word' ? '0' : '50%',
            zIndex: 1
          }}
        />
        
        {/* Word button - exactly 50% width */}
        <button
          onClick={() => setInputType('word')}
          className="relative z-10 cursor-pointer flex h-full w-1/2 items-center justify-center transition-all duration-200"
        >
          <ChewyText size={0.6} color={inputType === 'word' ? 'white' : colors.textSecondary}>
            Word
          </ChewyText>
        </button>
        
        {/* Phrase button - exactly 50% width */}
        <button
          onClick={() => setInputType('phrase')}
          className="relative z-10 cursor-pointer flex h-full w-1/2 items-center justify-center transition-all duration-200"
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

      {/* Search Term Modal with GIF Results */}
      <Modal
        title="Search for GIFs"
        isOpen={showSearchInput}
        onClose={() => setShowSearchInput(false)}
        onConfirm={confirmSearchInput}
      >
        <div className="flex flex-col gap-4">
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
              onClick={() => searchGifs(tempSearchTerm)}
              disabled={!tempSearchTerm || isLoading}
              className="rounded-xl bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
            >
              {isLoading ? '...' : '🔍'}
            </button>
          </div>

          {/* GIF Search Results - More compact grid */}
          {gifs.length > 0 && (
            <div className="mt-2 max-h-52 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectGifForSlot(gif)}
                    className="cursor-pointer overflow-hidden rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg"
                    style={{ backgroundColor: '#1A1A1B' }}
                  >
                    <div className="flex h-16 items-center justify-center bg-gray-900 p-2 text-center">
                      <ChewyText size={0.45} color={colors.textSecondary}>
                        {gif.content_description || gif.title || `GIF ${idx + 1}`}
                      </ChewyText>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center p-4">
              <ChewyText size={0.7} color={colors.textSecondary}>
                Searching for GIFs...
              </ChewyText>
            </div>
          )}

          {!isLoading && gifs.length === 0 && tempSearchTerm && (
            <div className="flex justify-center p-4">
              <ChewyText size={0.7} color={colors.textSecondary}>
                No GIFs found. Try another search term.
              </ChewyText>
            </div>
          )}
        </div>
      </Modal>

      {/* More compact header with integrated Word/Phrase Toggle */}
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

        {/* Status Messages - Smaller and integrated */}
        {message && (
          <div
            className="mb-2 rounded-lg border-l-3 p-2"
            style={{
              backgroundColor:
                messageType === 'success'
                  ? `${colors.success}22`
                  : messageType === 'error'
                    ? `${colors.error}22`
                    : `${colors.primary}22`,
              borderLeftColor:
                messageType === 'success'
                  ? colors.success
                  : messageType === 'error'
                    ? colors.error
                    : colors.primary,
            }}
          >
            <ChewyText size={0.6} color={colors.textPrimary}>
              {message}
            </ChewyText>
          </div>
        )}

        {/* Submit Button - More compact */}
        <button
          onClick={submitGame}
          disabled={
            isLoading || !secretInput || selectedGifs.filter((g) => g !== null).length !== 4
          }
          className={`mt-2 cursor-pointer rounded-xl border-none px-4 py-3 transition-all duration-300 ${
            isLoading || !secretInput || selectedGifs.filter((g) => g !== null).length !== 4
              ? 'cursor-not-allowed opacity-60'
              : 'hover:-translate-y-1 hover:scale-105 hover:shadow-lg active:scale-95'
          }`}
          style={{ backgroundColor: colors.primary }}
        >
          <ChewyText size={0.8} color="white">
            {isLoading ? '🔄 Creating...' : '🎮 Create GIF Enigma'}
          </ChewyText>
        </button>
      </div>
    </div>
  );
};
