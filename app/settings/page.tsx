'use client';

import { AuthGate } from '@/components/AuthGate';
import { useAuth } from '@/components/AuthProvider';
import { STARTING_CAPITAL } from '@/lib/types';
import { formatMoney } from '@/lib/format';

function SettingsContent() {
  const { user, signOut } = useAuth();

  return (
    <div className="panel settings-panel">
      <div className="panel-head">
        <h2>Account</h2>
      </div>
      <dl className="settings-list">
        <div>
          <dt>Email</dt>
          <dd>{user?.email ?? '—'}</dd>
        </div>
        <div>
          <dt>Starting capital</dt>
          <dd>
            {formatMoney(STARTING_CAPITAL)} virtual cash for new accounts
            (profiles default in <code>schema_step1.sql</code>). Existing
            balances are never reset by schema runs.
          </dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>Paper trading only — no real money is used or risked.</dd>
        </div>
        <div>
          <dt>Market data</dt>
          <dd>
            Live Yahoo Finance quotes via the Next.js route handler{' '}
            <code>/api/quote</code>. Optional Finnhub fallback if{' '}
            <code>FINNHUB_API_KEY</code> is set. No paid API key required for
            Yahoo.
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate title="Settings">
      <section className="section-panel">
        <SettingsContent />
      </section>
    </AuthGate>
  );
}
