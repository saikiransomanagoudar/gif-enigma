import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from '../pages/LandingPage';
// @ts-ignore
import { requestExpandedMode } from '@devvit/web/client';

function LandingEntry() {
  const handleNavigate = (page: string, event?: React.MouseEvent) => {
    const expandedPages = ['game', 'gameResults', 'howToPlay'];

    if (expandedPages.includes(page) && event) {
      requestExpandedMode(event.nativeEvent, page).catch(() => {
        console.error('Failed to enter expanded mode');
      });
    } else {
      window.location.href = `${page}.html`;
    }
  };

  return <LandingPage onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <LandingEntry />
  </React.StrictMode>
);
