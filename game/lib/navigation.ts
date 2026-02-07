import { Page } from './types';

export interface NavigationState {
  page: Page;
  gameId?: string;
}

const NAV_STORAGE_KEY = 'gif-enigma-nav-state';

export function getEntryPoint(): string {
  const urlParams = new URLSearchParams(window.location.search);

  const explicitEntry = urlParams.get('entrypoint');
  if (explicitEntry) {
    return explicitEntry;
  }

  const gameId = urlParams.get('gameId');
  const page = urlParams.get('page');

  if (gameId && !page) {
    return 'game';
  }

  return 'default';
}
export function getInitialNavigationState(): NavigationState {
  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = urlParams.get('page') as Page;
  const gameIdParam = urlParams.get('gameId');

  if (pageParam) {
    return {
      page: pageParam,
      ...(gameIdParam && { gameId: gameIdParam }),
    };
  }

  const stored = localStorage.getItem(NAV_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as NavigationState;

    const timestamp = localStorage.getItem(`${NAV_STORAGE_KEY}-timestamp`);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      const ONE_HOUR = 60 * 60 * 1000;

      if (age < ONE_HOUR) {
        return parsed;
      }
    }
  }

  return { page: 'landing' };
}

export function navigateTo(state: NavigationState): void {
  const { page, gameId } = state;

  const searchParams = new URLSearchParams();
  searchParams.set('page', page);

  if (gameId) {
    searchParams.set('gameId', gameId);
  }

  const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
  window.history.pushState(state, '', newUrl);

  localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(`${NAV_STORAGE_KEY}-timestamp`, Date.now().toString());
}

export function goBack(): void {
  window.history.back();
}

export function clearNavigationState(): void {
  localStorage.removeItem(NAV_STORAGE_KEY);
  localStorage.removeItem(`${NAV_STORAGE_KEY}-timestamp`);
}

export function setupNavigationListener(onNavigate: (state: NavigationState) => void): () => void {
  const handlePopState = (event: PopStateEvent) => {
    if (event.state && event.state.page) {
      onNavigate(event.state);
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') as Page;
    const gameId = urlParams.get('gameId');

    if (page) {
      onNavigate({
        page,
        ...(gameId && { gameId }),
      });
    } else {
      onNavigate({ page: 'landing' });
    }
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}
