'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/errors';
import {
  formatDailyChange,
  formatMoney,
  formatPct,
  formatShares,
  plClass,
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
import type { EnrichedHolding } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { usePortfolio } from './PortfolioProvider';

type Props = {
  holding: EnrichedHolding;
  onClose: () => void;
};

export function HoldingDetailModal({ holding, onClose }: Props) {
  const { user } = useAuth();
  const { cash, refresh, cacheQuote } = usePortfolio();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [shares, setShares] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(holding.price);
  const [liveQuote, setLiveQuote] = useState(holding.quote);

  useEffect(() => {
    setLivePrice(holding.price);
    setLiveQuote(holding.quote);
    setShares('');
    setMessage(null);
    setError(null);
  }, [holding]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const daily = formatDailyChange(liveQuote);
  const marketValue =
    livePrice != null ? holding.shares * livePrice : holding.marketValue;
  const cost = holding.shares * holding.avgCost;
  const unrealized =
    marketValue != null ? marketValue - cost : holding.unrealized;
  const unrealizedPct =
    unrealized != null && cost > 0
      ? (unrealized / cost) * 100
      : holding.unrealizedPct;

  const qty = Number(shares);
  const qtyValid = Number.isFinite(qty) && qty > 0;
  const maxBuy = useMemo(
    () => maxAffordableShares(cash, livePrice),
    [cash, livePrice]
  );
  const buyBlocked =
    qtyValid && livePrice != null
      ? buyAffordabilityError(qty, livePrice, cash) != null
      : maxBuy === 0;
  const sellBlocked =
    qtyValid && sellSharesError(qty, holding.shares) != null;

  async function ensureQuotePrice(): Promise<number> {
    if (typeof livePrice === 'number' && Number.isFinite(livePrice)) {
      return livePrice;
    }
    try {
      const quote = await getQuote(holding.symbol);
      setLiveQuote(quote);
      setLivePrice(quote.price);
      cacheQuote(quote);
      return quote.price;
    } catch (err) {
      throw new Error(
        getErrorMessage(
          err,
          `Live quote unavailable for ${holding.symbol}. Try Refresh quotes, then trade again.`
        )
      );
    }
  }

  async function executeTrade(side: 'buy' | 'sell') {
    if (!user) {
      setError('You must be signed in to trade.');
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
      const price = await ensureQuotePrice();

      if (side === 'buy') {
        const affordErr = buyAffordabilityError(nextQty, price, cash);
        if (affordErr) {
          setError(affordErr);
          return;
        }
        await buyStock(holding.symbol, nextQty, price);
        setMessage(
          `Bought ${formatShares(nextQty)} ${holding.symbol} @ ${formatMoney(price)}.`
        );
      } else {
        const sellErr = sellSharesError(nextQty, holding.shares);
        if (sellErr) {
          setError(sellErr);
          return;
        }
        await sellStock(holding.symbol, nextQty, price);
        setMessage(
          `Sold ${formatShares(nextQty)} ${holding.symbol} @ ${formatMoney(price)}.`
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

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <div>
            <p className="modal-kicker muted">Position detail</p>
            <h2 id={titleId} className="modal-title">
              {holding.symbol}
              {liveQuote?.name ? (
                <span className="muted modal-name">{liveQuote.name}</span>
              ) : null}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close position detail"
          >
            Close
          </button>
        </div>

        {holding.priceError && livePrice == null ? (
          <p className="error banner-error" role="alert">
            {holding.priceError ||
              `Live quote unavailable for ${holding.symbol}.`}
          </p>
        ) : null}

        <dl className="detail-grid">
          <div>
            <dt>Current price</dt>
            <dd>
              {livePrice != null
                ? formatMoney(livePrice, liveQuote?.currency)
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Position value</dt>
            <dd>{marketValue != null ? formatMoney(marketValue) : '—'}</dd>
          </div>
          <div>
            <dt>Shares owned</dt>
            <dd>{formatShares(holding.shares)}</dd>
          </div>
          <div>
            <dt>Avg cost basis</dt>
            <dd>{formatMoney(holding.avgCost)}</dd>
          </div>
          <div>
            <dt>Unrealized P/L</dt>
            <dd className={plClass(unrealized)}>
              {unrealized != null && unrealizedPct != null
                ? `${formatMoney(unrealized)} (${formatPct(unrealizedPct)})`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Daily change</dt>
            <dd className={daily.cls}>{daily.text}</dd>
          </div>
          <div className="detail-span">
            <dt>Cash available to trade</dt>
            <dd>{cash != null ? formatMoney(cash) : 'Loading…'}</dd>
          </div>
        </dl>

        <form
          className="stack trade-form"
          onSubmit={(e) => {
            e.preventDefault();
            void executeTrade('buy');
          }}
        >
          <label className="field">
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
              autoComplete="off"
            />
          </label>
          <p className="muted small trade-hint">
            Cash {cash != null ? formatMoney(cash) : '…'}
            {maxBuy != null ? (
              <>
                {' '}
                · Max buy {formatShares(maxBuy)} {holding.symbol}
              </>
            ) : null}
            {' '}
            · Owned {formatShares(holding.shares)}
          </p>
          <div className="btn-row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || buyBlocked}
            >
              {busy ? 'Working…' : 'Buy more'}
            </button>
            <button
              type="button"
              className="btn btn-sell"
              disabled={busy || sellBlocked}
              onClick={() => {
                void executeTrade('sell');
              }}
            >
              Sell
            </button>
          </div>
        </form>

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
    </div>
  );
}
