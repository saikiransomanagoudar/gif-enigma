import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GamePagePreview } from '../components/GamePagePreview';
import { requestExpandedMode } from '@devvit/web/client';

function PreviewEntry() {
  const handleNavigate = async (page: string, params?: { gameId?: string }, event?: React.MouseEvent) => {
    const expandedPages = ['game', 'gameResults', 'howToPlay'];
    
    if (expandedPages.includes(page) && event) {
      try {
        await requestExpandedMode(event.nativeEvent, page);
      } catch (error) {
        console.error('Failed to enter expanded mode:', error);
      }
    } else {
      const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
      window.location.href = url;
    }
  };

  // Get gameId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');

  if (!gameId) {
    return <div>Error: No game ID provided</div>;
  }

  return <GamePagePreview gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <PreviewEntry />
  </React.StrictMode>
);
