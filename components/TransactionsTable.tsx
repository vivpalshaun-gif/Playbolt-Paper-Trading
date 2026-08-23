'use client';

import {
  formatDateTime,
  formatMoney,
  formatShares,
} from '@/lib/format';
import { usePortfolio } from './PortfolioProvider';

export function TransactionsTable() {
  const { transactions, txError } = usePortfolio();

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
            <th>Date</th>
            <th>Type</th>
            <th>Symbol</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((row) => {
            const side = String(row.side ?? '').toLowerCase();
            return (
              <tr key={row.id}>
                <td>{row.created_at ? formatDateTime(row.created_at) : '—'}</td>
                <td className={`side-${side}`}>{side || '—'}</td>
                <td>{row.symbol}</td>
                <td>{formatShares(Number(row.shares))}</td>
                <td>{formatMoney(row.price)}</td>
                <td>{formatMoney(row.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
