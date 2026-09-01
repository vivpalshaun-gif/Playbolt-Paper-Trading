'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getErrorMessage, toUserFacingApiError } from '@/lib/errors';
import {
  formatDailyChange,
  formatMoney,
  formatShares,
} from '@/lib/format';
import { isConnectionError, LOCAL_SERVER_DOWN_MESSAGE } from '@/lib/http';
import { cancelLimitOrder, placeLimitOrder } from '@/lib/limitOrders';
import { getQuote, searchSymbols } from '@/lib/market';
import { normalizeSymbol } from '@/lib/symbols';
import {
  buyAffordabilityError,
  buyStock,
  formatTradeError,
  maxAffordableShares,
  sellSharesError,
  sellStock,
} from '@/lib/trading';
import type { LimitOrder, Quote, SearchResult } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { usePortfolio } from './PortfolioProvider';
import { SymbolTag } from './SymbolTag';

type OrderType = 'market' | 'limit';

export function TradePanel({
  compact = false,
  initialSymbol,
}: {
  compact?: boolean;
  initialSymbol?: string;
}) {
  const { user } = useAuth();
  const { cash, holdings, refresh, cacheQuote, limitOrders, reloadLimitOrders } =
    usePortfolio();
  const [ticker, setTicker] = useState(initialSymbol ?? '');
  const [shares, setShares] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!initialSymbol) return;
    const symbol = normalizeSymbol(initialSymbol);
    setTicker(symbol);
    setError(null);
    setMessage(null);
    setBusy(true);
    void (async () => {
      try {
        const next = await getQuote(symbol);
        setQuote(next);
        cacheQuote(next);
        setLimitPrice(String(next.price));
      } catch (err) {
        setQuote(null);
        setError(
          toUserFacingApiError(
            err,
            'Invalid stock ticker. Please check the symbol and try again.'
          )
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [initialSymbol, cacheQuote]);

  useEffect(() => {
    const q = ticker.trim();
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
  }, [ticker]);

  const ownedShares = useMemo(() => {
    if (!quote) return 0;
    const row = holdings.find((h) => h.symbol === quote.symbol);
    return row?.shares ?? 0;
  }, [holdings, quote]);

  const qty = Number(shares);
  const qtyValid = Number.isFinite(qty) && qty > 0;
  const limitPx = Number(limitPrice);
  const limitValid = Number.isFinite(limitPx) && limitPx > 0;
  const execPrice =
    orderType === 'limit' && limitValid ? limitPx : quote?.price ?? null;

  const maxBuy = useMemo(
    () =>
      execPrice != null ? maxAffordableShares(cash, execPrice) : null,
    [cash, execPrice]
  );
  const buyBlocked =
    !quote ||
    quote.simulated === true ||
    (qtyValid && execPrice != null
      ? buyAffordabilityError(qty, execPrice, cash) != null
      : maxBuy === 0);
  const sellBlocked =
    !quote ||
    quote.simulated === true ||
    (qtyValid && sellSharesError(qty, ownedShares) != null);

  const openOrders: LimitOrder[] = limitOrders ?? [];

  async function lookupQuote(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setMessage(null);
    const symbol = normalizeSymbol(ticker);
    setTicker(symbol);
    setSuggestions([]);
    if (!symbol) {
      setError('Enter a ticker symbol.');
      return;
    }
    setBusy(true);
    try {
      const next = await getQuote(symbol);
      setQuote(next);
      cacheQuote(next);
      setLimitPrice(String(next.price));
    } catch (err) {
      setQuote(null);
      setError(
        toUserFacingApiError(
          err,
          'Invalid stock ticker. Please check the symbol and try again.'
        )
      );
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
      if (orderType === 'limit') {
        const px = Number(limitPrice);
        if (!Number.isFinite(px) || px <= 0) {
          setError('Enter a valid limit price.');
          return;
        }
        if (side === 'buy') {
          const affordErr = buyAffordabilityError(nextQty, px, cash);
          if (affordErr) {
            setError(affordErr);
            return;
          }
        } else {
          const sellErr = sellSharesError(nextQty, ownedShares);
          if (sellErr) {
            setError(sellErr);
            return;
          }
        }
        await placeLimitOrder(quote.symbol, side, nextQty, px);
        setMessage(
          `Limit ${side} placed: ${formatShares(nextQty)} ${quote.symbol} @ ${formatMoney(px)}.`
        );
        setShares('');
        await reloadLimitOrders();
        await refresh();
        return;
      }

      // Market order
      if (side === 'buy') {
        const affordErr = buyAffordabilityError(nextQty, quote.price, cash);
        if (affordErr) {
          setError(affordErr);
          return;
        }
        await buyStock(quote.symbol, nextQty, quote.price);
        setMessage(
          `Bought ${formatShares(nextQty)} ${quote.symbol} @ ${formatMoney(quote.price, 'USD')} USD.`
        );
      } else {
        const sellErr = sellSharesError(nextQty, ownedShares);
        if (sellErr) {
          setError(sellErr);
          return;
        }
        await sellStock(quote.symbol, nextQty, quote.price);
        setMessage(
          `Sold ${formatShares(nextQty)} ${quote.symbol} @ ${formatMoney(quote.price, 'USD')} USD.`
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

  async function onCancelOrder(id: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelLimitOrder(id);
      setMessage('Limit order cancelled.');
      await reloadLimitOrders();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cancel order.'));
    } finally {
      setBusy(false);
    }
  }

  const daily = formatDailyChange(quote);

  return (
    <div>
      <div className="order-type-toggle" role="group" aria-label="Order type">
        <button
          type="button"
          className={`toggle-btn${orderType === 'market' ? ' active' : ''}`}
          onClick={() => setOrderType('market')}
          disabled={busy}
        >
          Market
        </button>
        <button
          type="button"
          className={`toggle-btn${orderType === 'limit' ? ' active' : ''}`}
          onClick={() => setOrderType('limit')}
          disabled={busy}
        >
          Limit
        </button>
      </div>
      <p className="muted small order-type-hint">
        {orderType === 'market'
          ? 'Buy/sell instantly at the live quote.'
          : 'Buys at or below your limit · sells at or above. Fills when quotes refresh.'}
      </p>

      <form
        className={compact ? 'inline-form' : 'stack'}
        onSubmit={(e) => {
          void lookupQuote(e);
        }}
        autoComplete="off"
      >
        <label className={`field${compact ? ' grow' : ''} ticker-field`}>
          <span>Ticker (US · ADR · .T .NS .L)</span>
          <input
            name="ticker"
            type="text"
            maxLength={20}
            placeholder="AAPL, SONY, 7203.T…"
            spellCheck={false}
            required
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setQuote(null);
              setError(null);
            }}
            disabled={busy}
          />
          {suggestions.length > 0 && !quote ? (
            <ul className="search-suggestions" role="listbox">
              {suggestions.slice(0, 6).map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    className="search-suggestion"
                    onClick={() => {
                      setTicker(s.symbol);
                      setSuggestions([]);
                      setBusy(true);
                      void getQuote(s.symbol)
                        .then((next) => {
                          setQuote(next);
                          cacheQuote(next);
                          setLimitPrice(String(next.price));
                          setError(null);
                        })
                        .catch((err) =>
                          setError(
                            toUserFacingApiError(err, 'Could not fetch quote.')
                          )
                        )
                        .finally(() => setBusy(false));
                    }}
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
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {busy && !quote ? 'Loading…' : compact ? 'Quote' : 'Get quote'}
        </button>
      </form>

      {quote ? (
        <div className="quote-panel">
          <p className="quote-line">
            <span className="quote-symbol">{quote.symbol}</span>
            <SymbolTag symbol={quote.symbol} exchange={quote.exchange} />
            <span className="quote-name muted">{quote.name ?? ''}</span>
            {quote.simulated ? (
              <span className="pill pill-sim">Simulated</span>
            ) : quote.marketState ? (
              <span className="pill muted">{quote.marketState}</span>
            ) : null}
            {compact && daily.text !== '—' ? (
              <span className={`quote-change ${daily.cls}`}>{daily.text}</span>
            ) : null}
          </p>
          <p className="quote-price">
            <span>{formatMoney(quote.price, 'USD')}</span>
            <span className="muted small"> USD</span>
          </p>
          {quote.nativeCurrency &&
          quote.nativeCurrency !== 'USD' &&
          quote.nativePrice != null ? (
            <p className="muted small">
              Native {formatMoney(quote.nativePrice, quote.nativeCurrency)}{' '}
              {quote.nativeCurrency}
              {quote.fxRate != null ? ` · FX ${quote.fxRate.toFixed(4)}` : ''}
            </p>
          ) : null}
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
          {orderType === 'limit' ? (
            <label className={`field${compact ? ' grow' : ''}`}>
              <span>Limit price</span>
              <input
                name="limitPrice"
                type="number"
                min={0.0001}
                step="any"
                placeholder={String(quote.price)}
                required
                value={limitPrice}
                onChange={(e) => {
                  setLimitPrice(e.target.value);
                  setError(null);
                }}
                disabled={busy}
              />
            </label>
          ) : null}
          {compact ? (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || buyBlocked || (orderType === 'limit' && !limitValid)}
              >
                {orderType === 'limit' ? 'Limit buy' : 'Buy'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || sellBlocked || (orderType === 'limit' && !limitValid)}
                onClick={() => {
                  void executeTrade('sell');
                }}
              >
                {orderType === 'limit' ? 'Limit sell' : 'Sell'}
              </button>
            </>
          ) : (
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || buyBlocked || (orderType === 'limit' && !limitValid)}
              >
                {orderType === 'limit' ? 'Place limit buy' : 'Buy'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || sellBlocked || (orderType === 'limit' && !limitValid)}
                onClick={() => {
                  void executeTrade('sell');
                }}
              >
                {orderType === 'limit' ? 'Place limit sell' : 'Sell'}
              </button>
            </div>
          )}
        </form>
      ) : null}

      {!compact && openOrders.length > 0 ? (
        <div className="open-orders">
          <h3 className="open-orders-title">Open limit orders</h3>
          <ul className="open-orders-list">
            {openOrders.map((o) => (
              <li key={o.id}>
                <span>
                  {String(o.side).toUpperCase()} {formatShares(Number(o.shares))}{' '}
                  {o.symbol} @ {formatMoney(Number(o.limit_price))}
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={busy}
                  onClick={() => void onCancelOrder(o.id)}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
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
