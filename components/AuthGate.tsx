'use client';

import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from './LoginScreen';
import { PortfolioProvider } from './PortfolioProvider';
import { AppShell } from './AppShell';
import { ToastProvider } from './ToastProvider';

export function AuthGate({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { user, loading, configMissing } = useAuth();

  if (configMissing) {
    return (
      <ToastProvider>
        <LoginScreen />
      </ToastProvider>
    );
  }

  if (loading) {
    return (
      <ToastProvider>
        <p className="muted loading-msg boot-loading">Checking session…</p>
      </ToastProvider>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <LoginScreen />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PortfolioProvider>
        <AppShell title={title}>{children}</AppShell>
      </PortfolioProvider>
    </ToastProvider>
  );
}
