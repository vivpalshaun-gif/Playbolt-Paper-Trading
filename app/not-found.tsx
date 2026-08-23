import Link from 'next/link';

export default function NotFound() {
  try {
    return (
      <div className="not-found-shell">
        <p className="brand-mark">Playbolt</p>
        <h1>404</h1>
        <p>This page doesn&apos;t exist in the simulator.</p>
        <Link href="/" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  } catch (err) {
    console.error('Not-found page failed:', err);
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>404</h1>
        <p>Page not found.</p>
        <a href="/">Back to Dashboard</a>
      </main>
    );
  }
}
