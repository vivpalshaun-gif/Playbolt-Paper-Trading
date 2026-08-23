'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { usePortfolio } from '@/components/PortfolioProvider';
import { getErrorMessage } from '@/lib/errors';
import {
  formatDailyChange,
  formatMoney,
} from '@/lib/format';
import { getQuote, getQuotes } from '@/lib/market';
import type { Quote } from '@/lib/types';
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
} from '@/lib/watchlist';

function WatchlistContent() {
  const { cacheQuote } = usePortfolio();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [failures, setFailures] = useState<Map<string, string>>(new Map());
  const [input, setInput] = useState('');
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
    } finally {
      setLoading(false);
    }
  }, [cacheQuote]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const symbol = input.trim().toUpperCase();
    setInput('');
    try {
      const quote = await getQuote(symbol);
      cacheQuote(quote);
      addToWatchlist(symbol);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err, `Could not add ${symbol}.`));
    }
  }

  async function onRemove(symbol: string) {
    removeFromWatchlist(symbol);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Watchlist</h2>
        <span className="muted small">Saved in this browser</span>
      </div>
      <form className="inline-form" onSubmit={(e) => void onAdd(e)} autoComplete="off">
        <label className="field grow">
          <span>Add symbol</span>
          <input
            name="symbol"
            type="text"
            maxLength={12}
            placeholder="e.g. MSFT"
            spellCheck={false}
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted">Loading quotes…</p> : null}
      {!symbols.length ? (
        <div className="muted">
          No symbols yet. Add tickers to track live prices.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table watchlist-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Daily Change</th>
                <th>Market</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {symbols.map((symbol) => {
                const quote = quotes.get(symbol);
                if (quote) {
                  const daily = formatDailyChange(quote);
                  return (
                    <tr key={symbol}>
                      <td>{quote.symbol}</td>
                      <td>{quote.name ?? '—'}</td>
                      <td>{formatMoney(quote.price, quote.currency)}</td>
                      <td className={daily.cls}>{daily.text}</td>
                      <td>{quote.marketState ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => void onRemove(symbol)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={symbol}>
                    <td>{symbol}</td>
                    <td className="cell-error" colSpan={3}>
                      {failures.get(symbol) ?? 'No usable price'}
                    </td>
                    <td>—</td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => void onRemove(symbol)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <AuthGate title="Watchlist">
      <section className="section-panel">
        <WatchlistContent />
      </section>
    </AuthGate>
  );
}
