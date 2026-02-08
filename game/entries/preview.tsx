import '../index.css';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GamePagePreview } from '../components/GamePagePreview';
// @ts-ignore
import { requestExpandedMode, context } from '@devvit/web/client';

function PreviewEntry() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [_error, setError] = useState<string | null>(null);

  const extractPostId = (url: string | null) => {
    if (!url) return null;
    const match = url.match(/\/comments\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  };

  const normalizePostId = (id: string) => (id.startsWith('t3_') ? id : `t3_${id}`);
  const getPostIdFromContext = () => {
    try {
      const postData = (context as any)?.postData;
      return (
        (context as any)?.postId ||
        postData?.id ||
        postData?.postId ||
        postData?.post?.id ||
        postData?.post?.postId ||
        postData?.thingId ||
        null
      );
    } catch {
      return null;
    }
  };

  useEffect(() => {
    async function loadGameId() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlGameId = urlParams.get('gameId');
        
        if (urlGameId) {
          setGameId(urlGameId);
          return;
        }

        const urlPostId = urlParams.get('postId') || urlParams.get('post_id') || urlParams.get('post');
        const pathPostId = extractPostId(window.location.pathname);
        const referrerPostId = extractPostId(document.referrer);
        const contextPostId = getPostIdFromContext();
        const postId = urlPostId || pathPostId || referrerPostId || contextPostId;

        if (!postId) {
          const response = await fetch('/api/post/current/game');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();

          if (data.success && data.gameId) {
            setGameId(data.gameId);
          } else {
            throw new Error(data.error || 'Failed to load game');
          }
        } else {
          const normalizedPostId = normalizePostId(postId);
          const response = await fetch(`/api/post/${encodeURIComponent(normalizedPostId)}/game`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();

          if (data.success && data.gameId) {
            setGameId(data.gameId);
          } else {
            throw new Error(data.error || 'Failed to load game');
          }
        }
      } catch (err) {
        setError(String(err));
      }
    }

    loadGameId();
  }, []);

  const handleNavigate = (page: string, params?: { gameId?: string }, event?: React.MouseEvent) => {
    const expandedPages = ['game', 'gameResults', 'howToPlay'];
    
    if (expandedPages.includes(page) && event) {
      try {
        if (page === 'game' && params?.gameId) {
          localStorage.setItem('pendingGameId', params.gameId);
        } else if (page === 'gameResults' && params?.gameId) {
          localStorage.setItem('pendingGameResultsId', params.gameId);
        }
        requestExpandedMode(event.nativeEvent, page);
      } catch (error) {
        const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
        window.location.href = url;
      }
    } else {
      const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
      window.location.href = url;
    }
  };

  return <GamePagePreview gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <PreviewEntry />
  </React.StrictMode>
);
