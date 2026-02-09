import '../index.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GameResultsPage } from '../pages/GameResultsPage';
// @ts-ignore
import { context } from '@devvit/web/client';

console.log('[GameResults Entry] Component loading...');

function GameResultsEntry() {
  const handleNavigate = (page: string, params?: { gameId?: string }) => {
    const url = params?.gameId ? `${page}.html?gameId=${params.gameId}` : `${page}.html`;
    window.location.href = url;
  };

  const [gameId, setGameId] = useState<string | undefined>(undefined);

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
        const contextGameId = (context as any)?.postData?.gameId as string | undefined;
        if (contextGameId) {
          setGameId(contextGameId);
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const urlGameId = urlParams.get('gameId');
        if (urlGameId) {
          if (urlGameId.startsWith('game_')) {
            setGameId(urlGameId);
            return;
          }

          const normalizedFromGameId = normalizePostId(urlGameId);
          const response = await fetch(
            `/api/post/${encodeURIComponent(normalizedFromGameId)}/game`
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();

          if (data.success && data.gameId) {
            setGameId(data.gameId);
            return;
          }
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
          setGameId(undefined);
          throw new Error(data.error || 'Failed to load game');
        }
      } catch (err) {
        setGameId(undefined);
      }
    }

    loadGameId();
  }, []);
  return <GameResultsPage gameId={gameId} onNavigate={handleNavigate} />;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <GameResultsEntry />
  </React.StrictMode>
);
