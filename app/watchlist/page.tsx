'use client';

import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { WatchlistPanel } from '@/components/WatchlistPanel';

export default function WatchlistPage() {
  const router = useRouter();

  return (
    <AuthGate title="Watchlist">
      <section className="section-panel">
        <div className="panel">
          <div className="panel-head">
            <h2>Favorites</h2>
            <span className="muted small">Pinned in this browser · live quotes</span>
          </div>
          <WatchlistPanel
            onQuickTrade={(symbol) => {
              router.push(`/trades?symbol=${encodeURIComponent(symbol)}`);
            }}
          />
        </div>
      </section>
    </AuthGate>
  );
}
