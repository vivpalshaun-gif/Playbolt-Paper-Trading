'use client';

import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from './LoginScreen';
import { PortfolioProvider } from './PortfolioProvider';
import { AppShell } from './AppShell';

export function AuthGate({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { user, loading, configMissing } = useAuth();

  if (configMissing) {
    return <LoginScreen />;
  }

  if (loading) {
    return <p className="muted loading-msg boot-loading">Checking session…</p>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <PortfolioProvider>
      <AppShell title={title}>{children}</AppShell>
    </PortfolioProvider>
  );
}
