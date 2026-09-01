'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { CashAvailableCard } from '@/components/CashAvailableCard';
import { TradePanel } from '@/components/TradePanel';
import { TransactionsTable } from '@/components/TransactionsTable';
import { usePortfolio } from '@/components/PortfolioProvider';
import { formatMoney, formatShares } from '@/lib/format';
import { cancelLimitOrder } from '@/lib/limitOrders';
import { getErrorMessage } from '@/lib/errors';
import { useState } from 'react';

function OpenLimitOrders() {
  const { limitOrders, reloadLimitOrders, refresh } = usePortfolio();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!limitOrders.length) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Open limit orders</h2>
        <span className="muted small">Auto-fill when price hits your target</span>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="open-orders-list">
        {limitOrders.map((o) => (
          <li key={o.id}>
            <span>
              {String(o.side).toUpperCase()} {formatShares(Number(o.shares))}{' '}
              {o.symbol} @ {formatMoney(Number(o.limit_price))}
            </span>
            <button
              type="button"
              className="btn-icon"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await cancelLimitOrder(o.id);
                    await reloadLimitOrders();
                    await refresh();
                  } catch (err) {
                    setError(getErrorMessage(err, 'Could not cancel.'));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradesContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get('symbol') ?? undefined;

  return (
    <section className="section-panel">
      <CashAvailableCard />
      <div className="split-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Buy / Sell</h2>
            <span className="muted small">Market &amp; limit orders</span>
          </div>
          <TradePanel initialSymbol={initialSymbol} />
        </div>
        <OpenLimitOrders />
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Trade history</h2>
          <span className="muted small">
            Every completed buy/sell with position changes
          </span>
        </div>
        <TransactionsTable />
      </div>
    </section>
  );
}

export default function TradesPage() {
  return (
    <AuthGate title="Trades">
      <Suspense fallback={<p className="muted">Loading trade desk…</p>}>
        <TradesContent />
      </Suspense>
    </AuthGate>
  );
}
