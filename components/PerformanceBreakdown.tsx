'use client';

import { useMemo } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { formatMoney, formatPct, plClass } from '@/lib/format';
import { usePortfolio } from './PortfolioProvider';

const CASH_COLOR = '#5b8def';
const STOCK_COLOR = '#3dba78';

export function PerformanceBreakdown() {
  const { cash, enriched, summary } = usePortfolio();

  const ranked = useMemo(() => {
    const withPl = enriched.filter(
      (h) => h.unrealizedPct != null && Number.isFinite(h.unrealizedPct)
    );
    const sorted = [...withPl].sort(
      (a, b) => (b.unrealizedPct ?? 0) - (a.unrealizedPct ?? 0)
    );
    return {
      best: sorted[0] ?? null,
      list: sorted,
    };
  }, [enriched]);

  const allocation = useMemo(() => {
    const cashAmt = cash ?? 0;
    const stocks = summary?.marketValue ?? 0;
    const total = cashAmt + stocks;
    if (total <= 0) {
      return {
        slices: [] as { name: string; value: number; color: string }[],
        cashPct: 0,
        stockPct: 0,
      };
    }
    return {
      slices: [
        { name: 'Cash', value: cashAmt, color: CASH_COLOR },
        { name: 'Stocks', value: stocks, color: STOCK_COLOR },
      ].filter((s) => s.value > 0),
      cashPct: (cashAmt / total) * 100,
      stockPct: (stocks / total) * 100,
    };
  }, [cash, summary?.marketValue]);

  return (
    <div className="perf-layout">
      <div className="perf-grid perf-grid-2">
        <article className="panel perf-card">
          <h3>Best performing stock</h3>
          {ranked.best ? (
            <>
              <p className="perf-symbol">
                {ranked.best.symbol}{' '}
                <span className="exchange-tag">
                  {(ranked.best.exchange ?? ranked.best.quote?.exchange ?? 'US').toUpperCase()}
                </span>
              </p>
              <p className={`metric-value ${plClass(ranked.best.unrealizedPct)}`}>
                {formatPct(ranked.best.unrealizedPct!)}
              </p>
              <p className="metric-hint">
                {ranked.best.unrealized != null
                  ? formatMoney(ranked.best.unrealized)
                  : '—'}{' '}
                unrealized P/L
              </p>
            </>
          ) : (
            <p className="muted">Add holdings to see the leader.</p>
          )}
        </article>

        <article className="panel perf-card perf-allocation">
          <h3>Asset allocation</h3>
          {allocation.slices.length ? (
            <div className="allocation-row">
              <div className="allocation-chart">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={allocation.slices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={52}
                      stroke="none"
                    >
                      {allocation.slices.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value))}
                      contentStyle={{
                        background: '#141c26',
                        border: '1px solid #2a3848',
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="allocation-legend">
                <li>
                  <span className="swatch" style={{ background: CASH_COLOR }} />
                  Cash {allocation.cashPct.toFixed(1)}%
                </li>
                <li>
                  <span className="swatch" style={{ background: STOCK_COLOR }} />
                  Stocks {allocation.stockPct.toFixed(1)}%
                </li>
              </ul>
            </div>
          ) : (
            <p className="muted">Loading allocation…</p>
          )}
        </article>
      </div>

      {ranked.list.length > 0 ? (
        <div className="table-wrap perf-rank-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>P/L %</th>
                <th>Unrealized P/L</th>
              </tr>
            </thead>
            <tbody>
              {ranked.list.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    <span className="symbol-cell">
                      <span className="symbol-text">{row.symbol}</span>
                      <span className="exchange-tag">
                        {(row.exchange ?? row.quote?.exchange ?? 'US').toUpperCase()}
                      </span>
                    </span>
                  </td>
                  <td className={plClass(row.unrealizedPct)}>
                    {row.unrealizedPct != null ? formatPct(row.unrealizedPct) : '—'}
                  </td>
                  <td className={plClass(row.unrealized)}>
                    {row.unrealized != null ? formatMoney(row.unrealized) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
