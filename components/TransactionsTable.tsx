'use client';

import { useMemo } from 'react';
import {
  formatDateTime,
  formatMoney,
  formatShares,
} from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { usePortfolio } from './PortfolioProvider';
import { SymbolCell } from './SymbolTag';

/** Running share balance after each trade (chronological). */
function withPositionDeltas(transactions: Transaction[]) {
  const chronological = [...transactions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const balances = new Map<string, number>();
  const byId = new Map<
    string,
    { before: number; after: number; delta: number }
  >();

  for (const row of chronological) {
    const symbol = row.symbol.toUpperCase();
    const shares = Number(row.shares);
    const side = String(row.side).toLowerCase();
    const before = balances.get(symbol) ?? 0;
    const delta = side === 'sell' ? -shares : shares;
    const after = before + delta;
    balances.set(symbol, after);
    byId.set(row.id, { before, after, delta });
  }

  return byId;
}

export function TransactionsTable({
  limit,
  showPositionChange = true,
}: {
  limit?: number;
  showPositionChange?: boolean;
}) {
  const { transactions, txError } = usePortfolio();

  const positionMap = useMemo(
    () => withPositionDeltas(transactions),
    [transactions]
  );

  const rows = limit ? transactions.slice(0, limit) : transactions;

  if (txError) {
    return (
      <p className="error" role="alert">
        {txError}
      </p>
    );
  }

  if (!transactions.length) {
    return <div className="muted">No trades yet.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table tx-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Type</th>
            <th>Symbol</th>
            <th>Shares</th>
            <th>Exec. price</th>
            <th>Total value</th>
            {showPositionChange ? <th>Position</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const side = String(row.side ?? '').toLowerCase();
            const pos = positionMap.get(row.id);
            return (
              <tr key={row.id}>
                <td>{row.created_at ? formatDateTime(row.created_at) : '—'}</td>
                <td className={`side-${side}`}>{side || '—'}</td>
                <td>
                  <SymbolCell symbol={row.symbol} />
                </td>
                <td>{formatShares(Number(row.shares))}</td>
                <td>{formatMoney(row.price)}</td>
                <td>{formatMoney(row.total)}</td>
                {showPositionChange ? (
                  <td className="pos-change">
                    {pos
                      ? `${formatShares(pos.before)} → ${formatShares(pos.after)}`
                      : '—'}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
