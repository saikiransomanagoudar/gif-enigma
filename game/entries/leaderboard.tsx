import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { requestExpandedMode } from '@devvit/web/client';

function LeaderboardEntry() {
  const handleNavigate = async (page: string, params?: { gameId?: string }, event?: React.MouseEvent) => {
    const expandedPages = ['gameResults'];
    
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

  // Get gameId from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId') || undefined;

  return <LeaderboardPage onNavigate={handleNavigate} gameId={gameId} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <LeaderboardEntry />
  </React.StrictMode>
);
