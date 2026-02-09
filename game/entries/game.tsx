import '../index.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from '../pages/GamePage';
import type { Page } from '../lib/types';
// @ts-ignore
import { requestExpandedMode, context } from '@devvit/web/client';

function GameEntry() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const handleNavigate = (page: Page, params?: { gameId?: string }) => {
    if (page === 'gameResults' && params?.gameId) {
      // Use requestExpandedMode for navigation to gameResults with gameId in URL
      const gameResultsUrl = `gameResults.html?gameId=${params.gameId}`;
      window.location.href = gameResultsUrl;
    } else {
      const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
      window.location.href = url;
    }
  };

  useEffect(() => {
    async function loadGameId() {
      try {
        const contextGameId = (context as any)?.postData?.gameId as string | undefined;
        if (contextGameId) {
          setGameId(contextGameId);
          setLoading(false);
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const urlGameId = urlParams.get('gameId');
        if (urlGameId) {
          setGameId(urlGameId);
          setLoading(false);
          return;
        }

        const urlPostId =
          urlParams.get('postId') || urlParams.get('post_id') || urlParams.get('post');
        const pathPostId = extractPostId(window.location.pathname);
        const referrerPostId = extractPostId(document.referrer);
        const contextPostId = getPostIdFromContext();
        const postId = urlPostId || pathPostId || referrerPostId || contextPostId;

        if (!postId) {
          throw new Error('No post context available');
        }

        const normalizedPostId = normalizePostId(postId);
        const response = await fetch(`/api/post/${encodeURIComponent(normalizedPostId)}/game`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success && data.gameId) {
          setGameId(data.gameId);
        } else {
          throw new Error(data.error || 'Failed to load game');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    loadGameId();
  }, []);

  if (loading || error || !gameId) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#000' }} />;
  }

  return <GamePage gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <GameEntry />
  </React.StrictMode>
);
