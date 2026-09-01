import type { Holding, LimitOrder, Quote, Transaction } from './types';

const CACHE_KEY = 'playbolt-portfolio-cache-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type PortfolioCacheSnapshot = {
  userId: string;
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
  limitOrders: LimitOrder[];
  quotes: [string, Quote][];
  fails: [string, string][];
  marketStatus: string;
  savedAt: number;
};

export function savePortfolioCache(
  userId: string,
  snap: {
    cash: number;
    holdings: Holding[];
    transactions: Transaction[];
    limitOrders: LimitOrder[];
    quotes: Map<string, Quote>;
    fails: Map<string, string>;
    marketStatus: string;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PortfolioCacheSnapshot = {
      userId,
      cash: snap.cash,
      holdings: snap.holdings,
      transactions: snap.transactions,
      limitOrders: snap.limitOrders,
      quotes: [...snap.quotes.entries()],
      fails: [...snap.fails.entries()],
      marketStatus: snap.marketStatus,
      savedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}

export function loadPortfolioCache(
  userId: string
): PortfolioCacheSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioCacheSnapshot;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.holdings)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cacheSnapshotToState(cached: PortfolioCacheSnapshot) {
  return {
    cash: cached.cash,
    holdings: cached.holdings,
    transactions: cached.transactions,
    limitOrders: cached.limitOrders,
    quotes: new Map(cached.quotes),
    fails: new Map(cached.fails),
    marketStatus: cached.marketStatus,
    filledOrders: 0,
  };
}

export function formatCacheAge(savedAt: number): string {
  const mins = Math.round((Date.now() - savedAt) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
