'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { usePortfolio } from './PortfolioProvider';

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const {
    marketStatus,
    refreshing,
    refresh,
    profileError,
    portfolioNote,
  } = usePortfolio();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <header className="workspace-header">
          <h1>{title}</h1>
          <div className="header-meta">
            <span className="market-status muted">{marketStatus}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={refreshing}
              onClick={() => {
                void refresh();
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh quotes'}
            </button>
          </div>
        </header>

        {profileError ? (
          <p className="error banner-error" role="alert">
            {profileError}
          </p>
        ) : null}
        {portfolioNote ? (
          <p className="muted portfolio-note">{portfolioNote}</p>
        ) : null}

        {children}
      </div>
    </div>
  );
}
