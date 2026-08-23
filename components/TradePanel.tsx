'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { getErrorMessage } from '@/lib/errors';
import {
  formatDailyChange,
  formatMoney,
  formatShares,
} from '@/lib/format';
import { getQuote } from '@/lib/market';
import {
  buyAffordabilityError,
  buyStock,
  formatTradeError,
  maxAffordableShares,
  sellSharesError,
  sellStock,
} from '@/lib/trading';
import type { Quote } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { usePortfolio } from './PortfolioProvider';

export function TradePanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { cash, holdings, refresh, cacheQuote } = usePortfolio();
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownedShares = useMemo(() => {
    if (!quote) return 0;
    const row = holdings.find((h) => h.symbol === quote.symbol);
    return row?.shares ?? 0;
  }, [holdings, quote]);

  const qty = Number(shares);
  const qtyValid = Number.isFinite(qty) && qty > 0;
  const maxBuy = useMemo(
    () => (quote ? maxAffordableShares(cash, quote.price) : null),
    [cash, quote]
  );
  const buyBlocked =
    !!quote &&
    (qtyValid
      ? buyAffordabilityError(qty, quote.price, cash) != null
      : maxBuy === 0);
  const sellBlocked =
    qtyValid && sellSharesError(qty, ownedShares) != null;

  async function lookupQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const symbol = ticker.trim().toUpperCase();
    setTicker(symbol);
    setBusy(true);
    try {
      const next = await getQuote(symbol);
      setQuote(next);
      cacheQuote(next);
    } catch (err) {
      setQuote(null);
      setError(getErrorMessage(err, 'Could not fetch quote.'));
    } finally {
      setBusy(false);
    }
  }

  async function executeTrade(side: 'buy' | 'sell') {
    if (!user) {
      setError('You must be signed in to trade.');
      return;
    }
    if (!quote) {
      setError('Get a quote before trading.');
      return;
    }
    const nextQty = Number(shares);
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setError('Enter a valid number of shares greater than 0.');
      return;
    }

    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (side === 'buy') {
        const affordErr = buyAffordabilityError(nextQty, quote.price, cash);
        if (affordErr) {
          setError(affordErr);
          return;
        }
        await buyStock(quote.symbol, nextQty, quote.price);
        setMessage(
          `Bought ${formatShares(nextQty)} ${quote.symbol} @ ${formatMoney(quote.price, quote.currency)}.`
        );
      } else {
        const sellErr = sellSharesError(nextQty, ownedShares);
        if (sellErr) {
          setError(sellErr);
          return;
        }
        await sellStock(quote.symbol, nextQty, quote.price);
        setMessage(
          `Sold ${formatShares(nextQty)} ${quote.symbol} @ ${formatMoney(quote.price, quote.currency)}.`
        );
      }
      setShares('');
      await refresh();
    } catch (err) {
      setError(formatTradeError(err));
    } finally {
      setBusy(false);
    }
  }

  const daily = formatDailyChange(quote);

  return (
    <div>
      <form
        className={compact ? 'inline-form' : 'stack'}
        onSubmit={(e) => {
          void lookupQuote(e);
        }}
        autoComplete="off"
      >
        <label className={`field${compact ? ' grow' : ''}`}>
          <span>Ticker</span>
          <input
            name="ticker"
            type="text"
            maxLength={12}
            placeholder="e.g. AAPL"
            spellCheck={false}
            required
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {busy && !quote ? 'Loading…' : compact ? 'Quote' : 'Get quote'}
        </button>
      </form>

      {quote ? (
        <div className="quote-panel">
          <p className="quote-line">
            <span className="quote-symbol">{quote.symbol}</span>
            <span className="quote-name muted">{quote.name ?? ''}</span>
            {!compact && quote.marketState ? (
              <span className="pill muted">{quote.marketState}</span>
            ) : null}
            {compact && daily.text !== '—' ? (
              <span className={`quote-change ${daily.cls}`}>{daily.text}</span>
            ) : null}
          </p>
          <p className="quote-price">
            <span>{formatMoney(quote.price, quote.currency)}</span>
            {!compact && quote.currency !== 'USD' ? (
              <span className="muted"> {quote.currency}</span>
            ) : null}
          </p>
          {!compact && daily.text !== '—' ? (
            <p className={`quote-daily muted ${daily.cls}`}>Day {daily.text}</p>
          ) : null}
          <p className="muted small trade-hint">
            Cash {cash != null ? formatMoney(cash) : '…'}
            {maxBuy != null ? (
              <>
                {' '}
                · Max buy {formatShares(maxBuy)}
              </>
            ) : null}
            {ownedShares > 0 ? (
              <>
                {' '}
                · Owned {formatShares(ownedShares)}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {quote ? (
        <form
          className={compact ? 'inline-form trade-inline' : 'stack trade-form'}
          onSubmit={(e) => {
            e.preventDefault();
            void executeTrade('buy');
          }}
        >
          <label className={`field${compact ? ' grow' : ''}`}>
            <span>Shares</span>
            <input
              name="shares"
              type="number"
              min={0.0001}
              step="any"
              placeholder="1"
              required
              value={shares}
              onChange={(e) => {
                setShares(e.target.value);
                setError(null);
              }}
              disabled={busy}
            />
          </label>
          {compact ? (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || buyBlocked}
              >
                Buy
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || sellBlocked}
                onClick={() => {
                  void executeTrade('sell');
                }}
              >
                Sell
              </button>
            </>
          ) : (
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || buyBlocked}
              >
                Buy
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || sellBlocked}
                onClick={() => {
                  void executeTrade('sell');
                }}
              >
                Sell
              </button>
            </div>
          )}
        </form>
      ) : null}

      {message ? (
        <p className="message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
