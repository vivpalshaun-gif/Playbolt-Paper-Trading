'use client';

import { useEffect } from 'react';
import { getErrorMessage } from '@/lib/errors';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App route error:', error);
  }, [error]);

  const message = getErrorMessage(
    error,
    'Something went wrong loading this page.'
  );

  return (
    <div className="login-shell">
      <div className="login-card panel">
        <p className="brand-mark">Playbolt</p>
        <h1>Couldn&apos;t load this page</h1>
        <p className="tagline">{message}</p>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
