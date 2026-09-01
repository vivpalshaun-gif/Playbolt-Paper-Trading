# Playbolt-Paper Trading

Next.js (App Router) paper-trading dashboard with Supabase Auth (Google OAuth), virtual cash, holdings, and live Yahoo Finance quotes (server route handler).

## App routes

| Route | Contents |
| --- | --- |
| `/` | Dashboard — cash available, net worth / P/L, top holdings, quick buy/sell |
| `/portfolio` | Full holdings table (click a row for position detail + buy/sell) |
| `/trades` | Quote + buy/sell desk and transaction history |
| `/watchlist` | Browser `localStorage` watchlist with live quotes |
| `/settings` | Email, sign out, paper-trading notes |

Unauthenticated users see Google sign-in. Custom `app/not-found.tsx` links back to `/`.

## Status

- Next.js App Router + React + TypeScript
- Supabase JS client (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_*` aliases)
- Google OAuth + profile cash balance (`schema_step1.sql` — new users start at `$100,000.00`; existing balances are not reset)
- Holdings, transactions, atomic `buy_stock` / `sell_stock` RPCs (`schema_step2.sql`)
- Limit orders (`schema_step4.sql`) — place buy/sell limits; auto-fill when quotes refresh
- Yahoo quotes via `GET /api/quote?symbol=AAPL` (optional Finnhub fallback with `FINNHUB_API_KEY`)
- Global tickers: US ADRs (SONY, TM, BABA, ASML, SHOP) and suffixes (`.T` Japan, `.NS` India, `.L` London). Quotes convert to USD. Invalid / not-found tickers show a clear error — no simulated fake prices.
- Dashboard: performance breakdown, watchlist favorites + sparklines, trade history
- Clickable holdings → detail modal with metrics and buy more / sell
- `schema_step3.sql` — idempotent verify/harden script for transactions RLS

> Legacy Vite files under `src/`, `index.html`, and `vite.config.js` were removed. Use `npm run dev` (Next.js on **port 3000**). The `dev` script frees port 3000 first (`kill-port`) so orphaned processes do not cause `ERR_CONNECTION_REFUSED`.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (always binds to 3000 — not Vite’s old `:5173`).

### Quotes

The browser calls `/api/quote`, which fetches Yahoo Finance server-side (no CORS). Invalid tickers and network failures return structured JSON errors and show in-app notices — never mock success prices.

## [ACTION REQUIRED FROM USER]

1. **Run SQL schemas in Supabase** (Dashboard → SQL → New query) if not already done:
   - `schema_step1.sql`
   - `schema_step2.sql`
   - Optionally `schema_step3.sql`
   - **`schema_step4.sql`** (limit orders — required for Market/Limit trading)
2. Confirm Google OAuth is enabled and the redirect URL includes your local origin (e.g. `http://localhost:3000` — update if you previously only allowed `:5173`)
3. Sign in, open **Trades** or **Dashboard**, look up a ticker, then buy/sell (Market or Limit)
4. Confirm **Portfolio** holdings open a detail modal; cash updates after trades
5. Pin tickers on **Watchlist** to track live quotes and sparklines