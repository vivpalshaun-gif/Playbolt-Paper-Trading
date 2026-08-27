'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  formatDailyChange,
  formatMoney,
  formatPct,
  formatShares,
  plClass,
} from '@/lib/format';
import type { EnrichedHolding } from '@/lib/types';
import { HoldingDetailModal } from './HoldingDetailModal';
import { usePortfolio } from './PortfolioProvider';
import { SymbolCell } from './SymbolTag';

export function HoldingsTable({
  compact = false,
  limit,
}: {
  compact?: boolean;
  limit?: number;
}) {
  const { enriched, holdingsError } = usePortfolio();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const rows = typeof limit === 'number' ? enriched.slice(0, limit) : enriched;

  const modalHolding =
    selectedSymbol == null
      ? null
      : (enriched.find((h) => h.symbol === selectedSymbol) ?? null);

  useEffect(() => {
    if (selectedSymbol && !modalHolding) {
      setSelectedSymbol(null);
    }
  }, [selectedSymbol, modalHolding]);

  if (holdingsError) {
    return (
      <p className="error" role="alert">
        {holdingsError}
      </p>
    );
  }

  if (!enriched.length) {
    return (
      <div className="muted">
        No positions yet.{' '}
        {!compact ? (
          <>
            Place a trade from the{' '}
            <Link href="/trades" className="link-btn">
              Trades
            </Link>{' '}
            page.
          </>
        ) : null}
      </div>
    );
  }

  function openHolding(item: EnrichedHolding) {
    setSelectedSymbol(item.symbol);
  }

  function onRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    item: EnrichedHolding
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openHolding(item);
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table className="data-table holdings-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Shares</th>
              {!compact ? <th>Avg Cost</th> : null}
              <th>{compact ? 'Price' : 'Current Price'}</th>
              <th>{compact ? 'Value' : 'Market Value'}</th>
              <th>{compact ? 'P/L' : 'Unrealized P/L'}</th>
              {!compact ? <th>Daily Change</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const daily = formatDailyChange(item.quote);
              const priceText =
                typeof item.price === 'number'
                  ? formatMoney(item.price, 'USD')
                  : item.priceError
                    ? 'No usable price'
                    : '—';
              const mktText =
                item.marketValue != null ? formatMoney(item.marketValue) : '—';
              const plText =
                item.unrealized != null && item.unrealizedPct != null
                  ? `${formatMoney(item.unrealized)} (${formatPct(item.unrealizedPct)})`
                  : '—';
              return (
                <tr
                  key={item.symbol}
                  className="holdings-row"
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${item.symbol}`}
                  onClick={() => openHolding(item)}
                  onKeyDown={(e) => onRowKeyDown(e, item)}
                >
                  <td>
                    <SymbolCell
                      symbol={item.symbol}
                      exchange={item.exchange ?? item.quote?.exchange}
                    />
                  </td>
                  <td>{formatShares(item.shares)}</td>
                  {!compact ? <td>{formatMoney(item.avgCost)}</td> : null}
                  <td className={item.priceError ? 'cell-error' : ''}>
                    {priceText}
                  </td>
                  <td>{mktText}</td>
                  <td className={plClass(item.unrealized)}>{plText}</td>
                  {!compact ? (
                    <td className={daily.cls}>{daily.text}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalHolding ? (
        <HoldingDetailModal
          holding={modalHolding}
          onClose={() => setSelectedSymbol(null)}
        />
      ) : null}
    </>
  );
}
