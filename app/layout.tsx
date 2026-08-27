import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Playbolt-Paper Trading',
    template: '%s · Playbolt-Paper Trading',
  },
  description:
    'Practice the markets with virtual cash — Supabase auth, live quotes, and paper portfolio tracking.',
  applicationName: 'Playbolt-Paper Trading',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Playbolt-Paper Trading',
    description:
      'Practice the markets with virtual cash — live quotes and paper portfolio tracking.',
    siteName: 'Playbolt-Paper Trading',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    return (
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <AuthProvider>{children}</AuthProvider>
        </body>
      </html>
    );
  } catch (err) {
    console.error('Root layout failed:', err);
    return (
      <html lang="en">
        <body>
          <main
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeContent: 'center',
              padding: '2rem',
              fontFamily: 'system-ui, sans-serif',
              background: '#080c10',
              color: '#f0f4f8',
            }}
          >
            <p role="alert">
              The app failed to start. Check your environment configuration and
              refresh the page.
            </p>
          </main>
        </body>
      </html>
    );
  }
}
