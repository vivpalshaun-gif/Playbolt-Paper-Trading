'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSignOut, onAuthStateChange, signInWithGoogle } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { hasSupabaseConfig } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authError: string | null;
  configMissing: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const configMissing = !hasSupabaseConfig();

  useEffect(() => {
    if (configMissing) {
      setLoading(false);
      return;
    }
    try {
      const unsub = onAuthStateChange((next) => {
        setSession(next);
        setLoading(false);
      });
      return unsub;
    } catch (err) {
      console.error('Auth listener failed to start:', err);
      setLoading(false);
      setAuthError(getErrorMessage(err, 'Could not connect to auth.'));
    }
  }, [configMissing]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Sign-in failed. Try again.'));
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await getSignOut();
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Sign-out failed.'));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authError,
      configMissing,
      signIn,
      signOut,
      clearAuthError: () => setAuthError(null),
    }),
    [session, loading, authError, configMissing, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
