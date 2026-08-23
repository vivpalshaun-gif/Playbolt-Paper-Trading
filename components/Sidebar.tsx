'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';

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
