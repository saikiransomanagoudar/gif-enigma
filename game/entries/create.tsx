import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CreatePage } from '../pages/CreatePage';
import { CategoryType } from '../pages/CategoryPage';

function CreateEntry() {
  const handleNavigate = (page: string) => {
    window.location.href = `${page}.html`;
  };

  // Extract category from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const category = (urlParams.get('category') as CategoryType) || 'Viral Vibes';
  console.log('[create.tsx] URL params:', { 
    fullURL: window.location.href, 
    search: window.location.search, 
    categoryParam: urlParams.get('category'), 
    category 
  });

  return <CreatePage onNavigate={handleNavigate} category={category} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <CreateEntry />
  </React.StrictMode>
);
