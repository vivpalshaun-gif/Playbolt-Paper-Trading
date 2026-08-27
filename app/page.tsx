'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { CashAvailableCard } from '@/components/CashAvailableCard';
import { HoldingsTable } from '@/components/HoldingsTable';
import { MetricsGrid } from '@/components/MetricsGrid';
import { PerformanceBreakdown } from '@/components/PerformanceBreakdown';
import { PriceChart } from '@/components/PriceChart';
import { TradePanel } from '@/components/TradePanel';
import { TransactionsTable } from '@/components/TransactionsTable';
import { WatchlistPanel } from '@/components/WatchlistPanel';

export default function DashboardPage() {
  const router = useRouter();
  const [tradeSymbol, setTradeSymbol] = useState<string | undefined>();

  return (
    <AuthGate title="Dashboard">
      <section className="section-panel">
        <CashAvailableCard />
        <MetricsGrid />

        <div className="panel">
          <div className="panel-head">
            <h2>Performance breakdown</h2>
          </div>
          <PerformanceBreakdown />
        </div>

        <PriceChart />

        <div className="split-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Watchlist favorites</h2>
              <Link href="/watchlist" className="link-btn">
                Manage
              </Link>
            </div>
            <WatchlistPanel
              compact
              onQuickTrade={(symbol, side) => {
                setTradeSymbol(symbol);
                if (side === 'sell') {
                  router.push(`/trades?symbol=${encodeURIComponent(symbol)}`);
                }
              }}
            />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Quick trade</h2>
              <Link href="/trades" className="link-btn">
                Full trade desk
              </Link>
            </div>
            <TradePanel compact initialSymbol={tradeSymbol} />
          </div>
        </div>

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
              <h2>Recent trades</h2>
              <Link href="/trades" className="link-btn">
                Full history
              </Link>
            </div>
            <TransactionsTable limit={8} />
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
