'use client';

import { useAuth } from './AuthProvider';

export function LoginScreen() {
  const { signIn, authError, configMissing } = useAuth();

  return (
    <div className="login-shell">
      <div className="login-card panel">
        <p className="brand-mark">Playbolt</p>
        <h1>Playbolt-Paper Trading</h1>
        <p className="tagline">
          Practice the markets with virtual cash — no real money at risk.
        </p>
        {configMissing ? (
          <p className="error" role="alert">
            Missing Supabase configuration. Copy `.env.example` to `.env.local`
            and set your project URL and anon key.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void signIn()}
          >
            Sign in with Google
          </button>
        )}
        {authError ? (
          <p className="error" role="alert">
            {authError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
