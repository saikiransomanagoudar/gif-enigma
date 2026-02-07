import '../index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CategoryPage } from '../pages/CategoryPage';

function CategoryEntry() {
  const handleNavigate = (page: string) => {
    window.location.href = `${page}.html`;
  };

  const handleCategorySelect = (category: string) => {
    window.location.href = `create.html?category=${encodeURIComponent(category)}`;
  };

  return <CategoryPage onNavigate={handleNavigate} onCategorySelect={handleCategorySelect} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <CategoryEntry />
  </React.StrictMode>
);
