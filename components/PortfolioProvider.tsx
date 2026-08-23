'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfile } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { getQuotes } from '@/lib/market';
import {
  enrichHoldings,
  summarizePortfolio,
} from '@/lib/format';
import {
  fetchHoldings,
  fetchTransactions,
  formatTradeError,
} from '@/lib/trading';
import type {
  EnrichedHolding,
  Holding,
  Quote,
  Transaction,
} from '@/lib/types';
import { useAuth } from './AuthProvider';

type PortfolioContextValue = {
  cash: number | null;
  holdings: Holding[];
  enriched: EnrichedHolding[];
  transactions: Transaction[];
  quoteMap: Map<string, Quote>;
  marketStatus: string;
  summary: ReturnType<typeof summarizePortfolio> | null;
  portfolioNote: string | null;
  profileError: string | null;
  holdingsError: string | null;
  txError: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  cacheQuote: (quote: Quote) => void;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cash, setCash] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quoteMap, setQuoteMap] = useState<Map<string, Quote>>(new Map());
  const [failMap, setFailMap] = useState<Map<string, string>>(new Map());
  const [marketStatus, setMarketStatus] = useState('—');
  const [portfolioNote, setPortfolioNote] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);

    try {
      const profile = await fetchProfile(user.id);
      setCash(Number(profile.cash_balance));
      setProfileError(null);
    } catch (err) {
      setProfileError(
        getErrorMessage(
          err,
          'Could not load your profile. Make sure schema_step1.sql has been run in Supabase.'
        )
      );
    }

    try {
      const nextHoldings = await fetchHoldings();
      setHoldings(nextHoldings);
      setHoldingsError(null);

      const symbols = nextHoldings.map((h) => h.symbol);
      const nextQuotes = new Map<string, Quote>();
      const nextFails = new Map<string, string>();

      if (symbols.length) {
        const { quotes, failed } = await getQuotes(symbols);
        for (const [symbol, quote] of quotes) {
          nextQuotes.set(symbol, quote);
        }
        for (const f of failed) {
          nextFails.set(f.symbol, f.message);
        }

        const states = [...quotes.values()]
          .map((q) => q.marketState)
          .filter(Boolean) as string[];
        if (states.length) {
          setMarketStatus(`Market · ${[...new Set(states)].join(' / ')}`);
        }
      }

      setQuoteMap(nextQuotes);
      setFailMap(nextFails);

      if (nextFails.size) {
        setPortfolioNote(
          `Live quote unavailable for ${[...nextFails.keys()].join(', ')}; net worth uses cash plus priced positions only.`
        );
      } else {
        setPortfolioNote(null);
      }
    } catch (err) {
      setHoldingsError(
        formatTradeError(err) ||
          'Could not load holdings. Run schema_step2.sql in the Supabase SQL Editor.'
      );
    }

    try {
      const rows = await fetchTransactions();
      setTransactions(rows);
      setTxError(null);
    } catch (err) {
      setTxError(
        formatTradeError(err) ||
          'Could not load transactions. Run schema_step2.sql in the Supabase SQL Editor.'
      );
    }

    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCash(null);
      setHoldings([]);
      setTransactions([]);
      setQuoteMap(new Map());
      setFailMap(new Map());
      setMarketStatus('—');
      setPortfolioNote(null);
      setProfileError(null);
      setHoldingsError(null);
      setTxError(null);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per user id
  }, [user?.id]);

  const cacheQuote = useCallback((quote: Quote) => {
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
      quoteMap,
      marketStatus,
      summary,
      portfolioNote,
      profileError,
      holdingsError,
      txError,
      refreshing,
      refresh,
      cacheQuote,
    }),
    [
      cash,
      holdings,
      enriched,
      transactions,
      quoteMap,
      marketStatus,
      summary,
      portfolioNote,
      profileError,
      holdingsError,
      txError,
      refreshing,
      refresh,
      cacheQuote,
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
