import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from '../pages/LandingPage';
// @ts-ignore
import { requestExpandedMode } from '@devvit/web/client';

function LandingEntry() {
  const handleNavigate = async (page: string, event?: React.MouseEvent) => {
    const expandedPages = ['game', 'gameResults', 'howToPlay'];
    
    if (expandedPages.includes(page) && event) {
      try {
        await requestExpandedMode(event.nativeEvent, page);
      } catch (error) {
        console.error('Failed to enter expanded mode:', error);
      }
    } else {
      // Navigate to other inline pages using window.location
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
