'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfile } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { getQuotes } from '@/lib/market';
import {
  checkServerHealth,
  isConnectionError,
  LOCAL_SERVER_DOWN_MESSAGE,
} from '@/lib/http';
import {
  cacheSnapshotToState,
  formatCacheAge,
  loadPortfolioCache,
  savePortfolioCache,
} from '@/lib/portfolioCache';
import {
  enrichHoldings,
  roundCents,
  summarizePortfolio,
} from '@/lib/format';
import {
  checkAndFillLimitOrders,
  fetchOpenLimitOrders,
} from '@/lib/limitOrders';
import {
  fetchHoldings,
  fetchTransactions,
  formatTradeError,
} from '@/lib/trading';
import type {
  EnrichedHolding,
  Holding,
  LimitOrder,
  Quote,
  Transaction,
} from '@/lib/types';
import { useAuth } from './AuthProvider';

type PortfolioContextValue = {
  cash: number | null;
  holdings: Holding[];
  enriched: EnrichedHolding[];
  transactions: Transaction[];
  limitOrders: LimitOrder[];
  quoteMap: Map<string, Quote>;
  marketStatus: string;
  summary: ReturnType<typeof summarizePortfolio> | null;
  portfolioNote: string | null;
  profileError: string | null;
  holdingsError: string | null;
  txError: string | null;
  connectionError: string | null;
  usingCachedData: boolean;
  refreshing: boolean;
  updatesAvailable: boolean;
  refresh: () => Promise<void>;
  reloadLimitOrders: () => Promise<void>;
  cacheQuote: (quote: Quote) => void;
  markUpdatesAvailable: () => void;
  clearConnectionError: () => void;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

const POLL_MS = 45_000;
const RECONNECT_MS = 5_000;

/** Stable fingerprint of portfolio + prices for change detection. */
function buildFingerprint(input: {
  cash: number | null;
  holdings: Holding[];
  quotes: Map<string, Quote>;
  transactions: Transaction[];
  limitOrders: LimitOrder[];
}): string {
  const holdingsPart = [...input.holdings]
    .map(
      (h) =>
        `${h.symbol}:${Number(h.shares)}:${roundCents(Number(h.avg_cost))}`
    )
    .sort()
    .join('|');
  const quotePart = [...input.quotes.entries()]
    .map(([sym, q]) => `${sym}:${roundCents(q.price)}`)
    .sort()
    .join('|');
  const txPart = input.transactions
    .map((t) => t.id)
    .sort()
    .join(',');
  const orderPart = input.limitOrders
    .map((o) => `${o.id}:${o.status}`)
    .sort()
    .join(',');
  return [
    input.cash == null ? 'null' : String(roundCents(input.cash)),
    holdingsPart,
    quotePart,
    txPart,
    orderPart,
  ].join('::');
}

async function fetchPortfolioSnapshot(userId: string): Promise<{
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
  limitOrders: LimitOrder[];
  quotes: Map<string, Quote>;
  fails: Map<string, string>;
  marketStatus: string;
  filledOrders: number;
}> {
  const profile = await fetchProfile(userId);
  let cash = Number(profile.cash_balance);
  let holdings = await fetchHoldings();
  const transactions = await fetchTransactions();

  let limitOrders: LimitOrder[] = [];
  try {
    limitOrders = await fetchOpenLimitOrders();
  } catch {
    limitOrders = [];
  }

  const symbols = [
    ...new Set([
      ...holdings.map((h) => h.symbol),
      ...limitOrders.map((o) => o.symbol),
    ]),
  ];

  const quotes = new Map<string, Quote>();
  const fails = new Map<string, string>();
  let marketStatus = '—';
  let filledOrders = 0;

  if (symbols.length) {
    const { quotes: nextQuotes, failed } = await getQuotes(symbols);
    for (const [symbol, quote] of nextQuotes) {
      quotes.set(symbol, quote);
    }
    for (const f of failed) {
      fails.set(f.symbol, f.message);
    }

    const states = [...nextQuotes.values()]
      .map((q) => q.marketState)
      .filter(Boolean) as string[];
    if (states.length) {
      marketStatus = `Market · ${[...new Set(states)].join(' / ')}`;
    }

    filledOrders = await checkAndFillLimitOrders(nextQuotes);
    if (filledOrders > 0) {
      const refreshed = await fetchProfile(userId);
      cash = Number(refreshed.cash_balance);
      holdings = await fetchHoldings();
      try {
        limitOrders = await fetchOpenLimitOrders();
      } catch {
        limitOrders = [];
      }
    }
  }

  return {
    cash,
    holdings,
    transactions,
    limitOrders,
    quotes,
    fails,
    marketStatus,
    filledOrders,
  };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cash, setCash] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [quoteMap, setQuoteMap] = useState<Map<string, Quote>>(new Map());
  const [failMap, setFailMap] = useState<Map<string, string>>(new Map());
  const [marketStatus, setMarketStatus] = useState('—');
  const [portfolioNote, setPortfolioNote] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatesAvailable, setUpdatesAvailable] = useState(false);

  const lastAppliedFingerprint = useRef<string | null>(null);
  const refreshingRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasLiveDataRef = useRef(false);

  const markUpdatesAvailable = useCallback(() => {
    setUpdatesAvailable(true);
  }, []);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const applySnapshot = useCallback(
    (
      snap: Awaited<ReturnType<typeof fetchPortfolioSnapshot>>,
      opts?: { fromCache?: boolean }
    ) => {
      setCash(snap.cash);
      setHoldings(snap.holdings);
      setTransactions(snap.transactions);
      setLimitOrders(snap.limitOrders);
      setQuoteMap(snap.quotes);
      setFailMap(snap.fails);
      if (snap.marketStatus !== '—') {
        setMarketStatus(snap.marketStatus);
      }
      if (snap.fails.size && !opts?.fromCache) {
        setPortfolioNote(
          `Live quote unavailable for ${[...snap.fails.keys()].join(', ')}; net worth uses cash plus priced positions only.`
        );
      } else if (!opts?.fromCache) {
        setPortfolioNote(null);
      }

      const fp = buildFingerprint({
        cash: snap.cash,
        holdings: snap.holdings,
        quotes: snap.quotes,
        transactions: snap.transactions,
        limitOrders: snap.limitOrders,
      });
      lastAppliedFingerprint.current = fp;
      setUpdatesAvailable(false);
      if (!opts?.fromCache) {
        hasLiveDataRef.current = true;
      }
    },
    []
  );

  const restoreFromCache = useCallback(
    (userId: string, opts?: { silent?: boolean }): boolean => {
      const cached = loadPortfolioCache(userId);
      if (!cached) return false;
      const snap = cacheSnapshotToState(cached);
      applySnapshot(snap, { fromCache: true });
      setUsingCachedData(true);
      if (!opts?.silent) {
        setPortfolioNote(
          `Showing cached portfolio saved ${formatCacheAge(cached.savedAt)}. Live data will resume when the server reconnects.`
        );
        setConnectionError(LOCAL_SERVER_DOWN_MESSAGE);
      }
      return true;
    },
    [applySnapshot]
  );

  const reloadLimitOrders = useCallback(async () => {
    if (!user) {
      setLimitOrders([]);
      return;
    }
    try {
      const rows = await fetchOpenLimitOrders();
      setLimitOrders(rows);
    } catch {
      setLimitOrders([]);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    refreshingRef.current = true;
    setRefreshing(true);
    // Clear highlight immediately on click
    setUpdatesAvailable(false);
    setConnectionError(null);

    try {
      const snap = await fetchPortfolioSnapshot(user.id);
      applySnapshot(snap);
      savePortfolioCache(user.id, snap);
      setUsingCachedData(false);
      setProfileError(null);
      setHoldingsError(null);
      setTxError(null);
      setConnectionError(null);
    } catch (err) {
      if (isConnectionError(err)) {
        setConnectionError(LOCAL_SERVER_DOWN_MESSAGE);
        setHoldingsError(null);
        if (hasLiveDataRef.current) {
          setUsingCachedData(true);
          setPortfolioNote(
            'Showing last known portfolio data. Live quotes will resume when the server reconnects.'
          );
        } else {
          restoreFromCache(user.id);
        }
      } else {
        setProfileError(
          getErrorMessage(
            err,
            'Could not refresh portfolio. Check your connection and try again.'
          )
        );
        setHoldingsError(formatTradeError(err));
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [user, applySnapshot, restoreFromCache]);

  /** Auto-reconnect: probe health endpoint and refresh when server returns. */
  useEffect(() => {
    if (!user || !connectionError) {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    reconnectTimerRef.current = window.setInterval(() => {
      void (async () => {
        const healthy = await checkServerHealth();
        if (healthy && !refreshingRef.current) {
          await refresh();
        }
      })();
    }, RECONNECT_MS);

    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [user, connectionError, refresh]);

  /** Silent poll: only flag the button if remote state differs from applied UI. */
  const pollForChanges = useCallback(async () => {
    if (!user || refreshingRef.current) return;
    try {
      const snap = await fetchPortfolioSnapshot(user.id);
      setConnectionError(null);
      const fp = buildFingerprint({
        cash: snap.cash,
        holdings: snap.holdings,
        quotes: snap.quotes,
        transactions: snap.transactions,
        limitOrders: snap.limitOrders,
      });
      if (
        lastAppliedFingerprint.current != null &&
        fp !== lastAppliedFingerprint.current
      ) {
        setUpdatesAvailable(true);
      }
    } catch (err) {
      if (isConnectionError(err)) {
        setConnectionError(LOCAL_SERVER_DOWN_MESSAGE);
      }
      // Ignore other poll errors — don't flash false update notices
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCash(null);
      setHoldings([]);
      setTransactions([]);
      setLimitOrders([]);
      setQuoteMap(new Map());
      setFailMap(new Map());
      setMarketStatus('—');
      setPortfolioNote(null);
      setProfileError(null);
      setHoldingsError(null);
      setTxError(null);
      setUpdatesAvailable(false);
      setConnectionError(null);
      setUsingCachedData(false);
      lastAppliedFingerprint.current = null;
      hasLiveDataRef.current = false;
      return;
    }

    // Hydrate from cache immediately so the UI isn't blank while fetching
    restoreFromCache(user.id, { silent: true });

    void refresh();

    const timer = window.setInterval(() => {
      void pollForChanges();
    }, POLL_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per user id
  }, [user?.id]);

  const cacheQuote = useCallback((quote: Quote) => {
    if (quote.simulated || !(quote.price > 0)) return;
    setQuoteMap((prev) => {
      const next = new Map(prev);
      next.set(quote.symbol, quote);
      return next;
    });
    if (quote.marketState) {
      setMarketStatus(`${quote.symbol} · ${quote.marketState}`);
    }
  }, []);

  const enriched = useMemo(
    () => enrichHoldings(holdings, quoteMap, failMap),
    [holdings, quoteMap, failMap]
  );

  const summary = useMemo(() => {
    if (cash == null) return null;
    return summarizePortfolio(cash, holdings, quoteMap);
  }, [cash, holdings, quoteMap]);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      cash,
      holdings,
      enriched,
      transactions,
      limitOrders,
      quoteMap,
      marketStatus,
      summary,
      portfolioNote,
      profileError,
      holdingsError,
      txError,
      connectionError,
      usingCachedData,
      refreshing,
      updatesAvailable,
      refresh,
      reloadLimitOrders,
      cacheQuote,
      markUpdatesAvailable,
      clearConnectionError,
    }),
    [
      cash,
      holdings,
      enriched,
      transactions,
      limitOrders,
      quoteMap,
      marketStatus,
      summary,
      portfolioNote,
      profileError,
      holdingsError,
      txError,
      connectionError,
      usingCachedData,
      refreshing,
      updatesAvailable,
      refresh,
      reloadLimitOrders,
      cacheQuote,
      markUpdatesAvailable,
      clearConnectionError,
    ]
  );

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
