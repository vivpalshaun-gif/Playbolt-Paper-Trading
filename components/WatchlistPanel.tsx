'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errors';
import { formatDailyChange, formatMoney } from '@/lib/format';
import { isConnectionError, LOCAL_SERVER_DOWN_MESSAGE } from '@/lib/http';
import { getQuote, getQuotes, searchSymbols } from '@/lib/market';
import { normalizeSymbol } from '@/lib/symbols';
import type { Quote, SearchResult } from '@/lib/types';
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  toggleWatchlist,
} from '@/lib/watchlist';
import { Sparkline } from './Sparkline';
import { usePortfolio } from './PortfolioProvider';
import { SymbolCell, SymbolTag } from './SymbolTag';

type Props = {
  compact?: boolean;
  onQuickTrade?: (symbol: string, side: 'buy' | 'sell') => void;
};

export function WatchlistPanel({ compact = false, onQuickTrade }: Props) {
  const { cacheQuote } = usePortfolio();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [failures, setFailures] = useState<Map<string, string>>(new Map());
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = loadWatchlist();
    setSymbols(list);
    if (!list.length) {
      setQuotes(new Map());
      setFailures(new Map());
      return;
    }
    setLoading(true);
    try {
      const { quotes: nextQuotes, failed } = await getQuotes(list);
      setQuotes(nextQuotes);
      setFailures(new Map(failed.map((f) => [f.symbol, f.message])));
      for (const q of nextQuotes.values()) cacheQuote(q);
      setError(null);
    } catch (err) {
      if (isConnectionError(err)) {
        setError(LOCAL_SERVER_DOWN_MESSAGE);
      } else {
        setError(getErrorMessage(err, 'Could not load watchlist quotes.'));
      }
    } finally {
      setLoading(false);
    }
  }, [cacheQuote]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const q = input.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchSymbols(q)
        .then(setSuggestions)
        .catch((err) => {
          setSuggestions([]);
          if (isConnectionError(err)) {
            setError(LOCAL_SERVER_DOWN_MESSAGE);
          }
        });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [input]);

  async function pinSymbol(raw: string) {
    setError(null);
    const symbol = normalizeSymbol(raw);
    setInput('');
    setSuggestions([]);
    try {
      const quote = await getQuote(symbol);
      cacheQuote(quote);
      addToWatchlist(symbol);
      await refresh();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Invalid stock ticker. Please check the symbol and try again.'
        )
      );
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await pinSymbol(input);
  }

  function onToggleStar(symbol: string) {
    toggleWatchlist(symbol);
    void refresh();
  }

  function onRemove(symbol: string) {
    removeFromWatchlist(symbol);
    void refresh();
  }

  const visible = compact ? symbols.slice(0, 6) : symbols;

  return (
    <div>
      <form className="inline-form" onSubmit={(e) => void onAdd(e)} autoComplete="off">
        <label className="field grow ticker-field">
          <span>Search & pin (global)</span>
          <input
            name="symbol"
            type="text"
            maxLength={20}
            placeholder="AAPL, BABA, 7203.T, RELIANCE.NS…"
            spellCheck={false}
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {suggestions.length > 0 ? (
            <ul className="search-suggestions" role="listbox">
              {suggestions.slice(0, 6).map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    className="search-suggestion"
                    onClick={() => void pinSymbol(s.symbol)}
                  >
                    <span className="suggestion-sym">
                      {s.symbol}{' '}
                      <SymbolTag symbol={s.symbol} exchange={s.country} />
                    </span>
                    <span className="muted small">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>
        <button type="submit" className="btn btn-primary" title="Add to watchlist">
          ★ Pin
        </button>
      </form>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !symbols.length ? <p className="muted">Loading quotes…</p> : null}

      {!symbols.length ? (
        <div className="muted empty-hint">
          Search US ADRs (SONY, TM) or international tickers (7203.T, RELIANCE.NS)
          and pin them with a star.
        </div>
      ) : (
        <ul className="watchlist-cards">
          {visible.map((symbol) => {
            const quote = quotes.get(symbol);
            const daily = formatDailyChange(quote);
            return (
              <li key={symbol} className="watchlist-card">
                <div className="watchlist-card-main">
                  <button
                    type="button"
                    className="star-btn starred"
                    title="Unpin"
                    aria-label={`Unpin ${symbol}`}
                    onClick={() => onToggleStar(symbol)}
                  >
                    ★
                  </button>
                  <div className="watchlist-meta">
                    <SymbolCell
                      symbol={symbol}
                      exchange={quote?.exchange}
                    />
                    {quote?.name ? (
                      <span className="muted small watchlist-name">{quote.name}</span>
                    ) : null}
                    {quote?.simulated ? (
                      <span className="pill pill-sim">Simulated</span>
                    ) : null}
                  </div>
                  <Sparkline symbol={symbol} />
                  <div className="watchlist-price-block">
                    {quote ? (
                      <>
                        <span className="watchlist-price">
                          {formatMoney(quote.price, 'USD')}
                        </span>
                        <span className={`small ${daily.cls}`}>{daily.text}</span>
                      </>
                    ) : (
                      <span className="cell-error small">
                        {failures.get(symbol) ?? 'No quote'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="watchlist-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    disabled={!quote}
                    onClick={() => onQuickTrade?.(symbol, 'buy')}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={!quote}
                    onClick={() => onQuickTrade?.(symbol, 'sell')}
                  >
                    Sell
                  </button>
                  {!compact ? (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => onRemove(symbol)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compact && symbols.length > 6 ? (
        <p className="muted small">+{symbols.length - 6} more on Watchlist</p>
      ) : null}
    </div>
  );
}
