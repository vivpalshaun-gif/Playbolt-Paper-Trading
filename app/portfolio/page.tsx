'use client';

import { AuthGate } from '@/components/AuthGate';
import { CashAvailableCard } from '@/components/CashAvailableCard';
import { HoldingsTable } from '@/components/HoldingsTable';
import { MetricsGrid } from '@/components/MetricsGrid';

export default function PortfolioPage() {
  return (
    <AuthGate title="Portfolio">
      <section className="section-panel">
        <CashAvailableCard />
        <MetricsGrid />
        <div className="panel">
          <div className="panel-head">
            <h2>Detailed holdings &amp; estimations</h2>
            <p className="muted panel-hint">Click a row for position detail</p>
          </div>
          <HoldingsTable />
        </div>
      </section>
    </AuthGate>
  );
}
