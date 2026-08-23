'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { CashAvailableCard } from '@/components/CashAvailableCard';
import { HoldingsTable } from '@/components/HoldingsTable';
import { MetricsGrid } from '@/components/MetricsGrid';
import { PriceChart } from '@/components/PriceChart';
import { TradePanel } from '@/components/TradePanel';

export default function DashboardPage() {
  return (
    <AuthGate title="Dashboard">
      <section className="section-panel">
        <CashAvailableCard />
        <MetricsGrid />
        <PriceChart />
        <div className="split-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Top holdings</h2>
              <Link href="/portfolio" className="link-btn">
                View all
              </Link>
            </div>
            <HoldingsTable compact limit={5} />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Quick trade</h2>
              <Link href="/trades" className="link-btn">
                Full trade desk
              </Link>
            </div>
            <TradePanel compact />
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
