'use client';

import { AuthGate } from '@/components/AuthGate';
import { CashAvailableCard } from '@/components/CashAvailableCard';
import { TradePanel } from '@/components/TradePanel';
import { TransactionsTable } from '@/components/TransactionsTable';

export default function TradesPage() {
  return (
    <AuthGate title="Trades">
      <section className="section-panel">
        <CashAvailableCard />
        <div className="split-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Buy / Sell</h2>
            </div>
            <TradePanel />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Transaction history</h2>
            </div>
            <TransactionsTable />
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
