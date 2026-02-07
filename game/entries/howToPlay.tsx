import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HowToPlayPage } from '../pages/HowToPlayPage';

function HowToPlayEntry() {
  const handleNavigate = (page: string) => {
    window.location.href = `${page}.html`;
  };

  return <HowToPlayPage onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <HowToPlayEntry />
  </React.StrictMode>
);
