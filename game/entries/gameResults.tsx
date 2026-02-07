import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameResultsPage } from '../pages/GameResultsPage';
import { exitExpandedMode } from '@devvit/web/client';

function GameResultsEntry() {
  const handleNavigate = (page: string, params?: { gameId?: string }) => {
    const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
    window.location.href = url;
  };

  // Get gameId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');

  if (!gameId) {
    return <div>Error: No game ID provided</div>;
  }

  return <GameResultsPage gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <GameResultsEntry />
  </React.StrictMode>
);
