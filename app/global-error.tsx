'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  const message =
    error instanceof Error && error.message?.trim()
      ? error.message.trim()
      : 'Something went wrong.';

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeContent: 'center',
          fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
          background: '#080c10',
          color: '#f0f4f8',
          padding: '2rem',
        }}
      >
        <div
          style={{
            width: 'min(24rem, 100%)',
            padding: '2rem 1.75rem',
            borderRadius: 12,
            border: '1px solid #2a3848',
            background: '#141c26',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#3dba78',
              fontWeight: 700,
            }}
          >
            Playbolt
          </p>
          <h1 style={{ margin: '0.35rem 0 0.5rem', fontSize: '1.45rem' }}>
            App error
          </h1>
          <p style={{ margin: '0 0 1.25rem', color: '#9aabbc', lineHeight: 1.45 }}>
            {message}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: 8,
              padding: '0.65rem 1rem',
              background: '#3dba78',
              color: '#06140c',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
