import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from '../pages/GamePage';
import { requestExpandedMode } from '@devvit/web/client';

function GameEntry() {
  const handleNavigate = async (page: string, params?: { gameId?: string }, event?: React.MouseEvent) => {
    if (page === 'gameResults' && event) {
      try {
        await requestExpandedMode(event.nativeEvent, 'gameResults');
      } catch (error) {
        console.error('Failed to switch to gameResults:', error);
      }
    }
  };

  // Get gameId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');

  if (!gameId) {
    return <div>Error: No game ID provided</div>;
  }

  return <GamePage gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <GameEntry />
  </React.StrictMode>
);
