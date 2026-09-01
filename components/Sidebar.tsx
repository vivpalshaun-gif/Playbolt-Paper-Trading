'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { usePortfolio } from './PortfolioProvider';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/trades', label: 'Trades' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/settings', label: 'Settings' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { refreshing, updatesAvailable, refresh } = usePortfolio();
  const [open, setOpen] = useState(false);
  const email = user?.email ?? '—';

  return (
    <aside
      id="sidebar"
      className={`sidebar${open ? ' is-open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <span className="brand-mark">Playbolt</span>
          <span className="brand-sub">Paper Trading</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={open}
          aria-controls="sidebar-nav"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav id="sidebar-nav" className="sidebar-nav">
        {NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? ' is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-actions">
        <button
          type="button"
          className={
            updatesAvailable && !refreshing
              ? 'w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 animate-pulse disabled:cursor-not-allowed disabled:opacity-70'
              : 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-70'
          }
          disabled={refreshing}
          aria-live="polite"
          onClick={() => {
            void refresh();
          }}
        >
          {refreshing
            ? 'Refreshing…'
            : updatesAvailable
              ? 'Update Available'
              : 'Refresh Data'}
        </button>
      </div>

      <div className="sidebar-footer">
        <p className="sidebar-email" title={email}>
          {email}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
