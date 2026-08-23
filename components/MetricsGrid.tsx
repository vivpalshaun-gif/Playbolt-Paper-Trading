'use client';

import { formatMoney, formatPct, plClass } from '@/lib/format';
import { usePortfolio } from './PortfolioProvider';

export function MetricsGrid() {
  const { cash, summary } = usePortfolio();

  const netWorth =
    summary != null ? formatMoney(summary.netWorth) : cash == null ? 'Loading…' : '—';
  const marketValueText =
    summary != null ? formatMoney(summary.marketValue) : 'Loading…';
  const unrealizedText =
    summary?.unrealized != null && summary.unrealizedPct != null
      ? `${formatMoney(summary.unrealized)} (${formatPct(summary.unrealizedPct)})`
      : summary != null
        ? '—'
        : 'Loading…';
  const realizedText =
    summary != null ? formatMoney(summary.realized) : 'Loading…';
  const accountText =
    summary != null
      ? `${formatMoney(summary.accountPl)} (${formatPct(summary.accountReturnPct)})`
      : 'Loading…';

  return (
    <div className="metrics-grid">
      <article className="metric-card">
        <h3>Net Worth</h3>
        <p className="metric-value">{netWorth}</p>
        <p className="metric-hint">Cash + positions</p>
      </article>
      <article className="metric-card">
        <h3>Positions value</h3>
        <p className="metric-value">{marketValueText}</p>
        <p className="metric-hint">Open holdings at mark</p>
      </article>
      <article className="metric-card">
        <h3>Unrealized P/L</h3>
        <p className={`metric-value ${plClass(summary?.unrealized)}`}>
          {unrealizedText}
        </p>
        <p className="metric-hint">Open positions only</p>
      </article>
      <article className="metric-card">
        <h3>Realized P/L</h3>
        <p className={`metric-value ${plClass(summary?.realized)}`}>
          {realizedText}
        </p>
        <p className="metric-hint">From closed trades</p>
      </article>
      <article className="metric-card">
        <h3>Account P/L</h3>
        <p className={`metric-value ${plClass(summary?.accountPl)}`}>
          {accountText}
        </p>
        <p className="metric-hint">vs $100k · unrealized + realized</p>
      </article>
    </div>
  );
}
