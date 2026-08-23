import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';
import type { Quote } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YAHOO_UA =
  'Mozilla/5.0 (compatible; PlayboltPaperTrading/0.2; +https://localhost)';

function errorJson(message: string, status = 400, symbol?: string) {
  return NextResponse.json(
    { ok: false as const, error: message, symbol },
    { status }
  );
}

function parseYahooChart(payload: unknown, normalized: string): Quote {
  const chart = (payload as { chart?: { result?: unknown[]; error?: { description?: string } } })
    ?.chart;
  const result = chart?.result?.[0] as
    | {
        meta?: Record<string, unknown>;
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }
    | undefined;
  const errorDescription = chart?.error?.description;

  if (!result) {
    throw new Error(
      errorDescription ||
        `Symbol not found: ${normalized}. Check the ticker and try again.`
    );
  }

  const meta = result.meta ?? {};
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const numericCloses = closes.filter(
    (v): v is number => typeof v === 'number' && !Number.isNaN(v)
  );
  const lastClose = numericCloses.length
    ? numericCloses[numericCloses.length - 1]
    : undefined;

  const price =
    typeof meta.regularMarketPrice === 'number'
      ? meta.regularMarketPrice
      : lastClose;

  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
    throw new Error(`No usable price for ${normalized}.`);
  }

  const previousClose =
    typeof meta.chartPreviousClose === 'number'
      ? meta.chartPreviousClose
      : typeof meta.previousClose === 'number'
        ? meta.previousClose
        : numericCloses.length >= 2
          ? numericCloses[numericCloses.length - 2]
          : null;

  let change: number | null = null;
  let changePercent: number | null = null;
  if (typeof previousClose === 'number' && previousClose > 0) {
    change = price - previousClose;
    changePercent = (change / previousClose) * 100;
  }

  return {
    symbol: typeof meta.symbol === 'string' ? meta.symbol : normalized,
    price,
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    name:
      (typeof meta.longName === 'string' && meta.longName) ||
      (typeof meta.shortName === 'string' && meta.shortName) ||
      undefined,
    previousClose,
    change,
    changePercent,
    marketState:
      typeof meta.marketState === 'string' ? meta.marketState : null,
  };
}

async function fetchYahooQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new Error(`Could not reach Yahoo Finance for ${symbol}.`);
  }

  if (!response.ok) {
    throw new Error(`Yahoo quote request failed (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Yahoo returned invalid data for ${symbol}.`);
  }

  return parseYahooChart(payload, symbol);
}

async function fetchFinnhubQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`;

  let quoteRes: Response;
  let profileRes: Response;
  try {
    [quoteRes, profileRes] = await Promise.all([
      fetch(quoteUrl, { cache: 'no-store' }),
      fetch(profileUrl, { cache: 'no-store' }),
    ]);
  } catch {
    throw new Error(`Could not reach Finnhub for ${symbol}.`);
  }

  if (!quoteRes.ok) {
    throw new Error(`Finnhub quote request failed (${quoteRes.status}).`);
  }

  let quoteData: { c?: number; pc?: number; d?: number; dp?: number };
  try {
    quoteData = (await quoteRes.json()) as {
      c?: number;
      pc?: number;
      d?: number;
      dp?: number;
    };
  } catch {
    throw new Error(`Finnhub returned invalid data for ${symbol}.`);
  }
  const price = quoteData.c;
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
    throw new Error(`No usable price for ${symbol}.`);
  }

  let name: string | undefined;
  if (profileRes.ok) {
    try {
      const profile = (await profileRes.json()) as { name?: string };
      if (profile.name) name = profile.name;
    } catch {
      /* ignore profile parse errors */
    }
  }

  const previousClose =
    typeof quoteData.pc === 'number' ? quoteData.pc : null;
  const change =
    typeof quoteData.d === 'number'
      ? quoteData.d
      : previousClose != null
        ? price - previousClose
        : null;
  const changePercent =
    typeof quoteData.dp === 'number'
      ? quoteData.dp
      : change != null && previousClose && previousClose > 0
        ? (change / previousClose) * 100
        : null;

  return {
    symbol,
    price,
    currency: 'USD',
    name,
    previousClose,
    change,
    changePercent,
    marketState: null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('symbol') ?? '';
    const symbol = raw.trim().toUpperCase();

    if (!symbol) {
      return errorJson('Enter a ticker symbol (e.g. AAPL).', 400);
    }

    if (!/^[A-Z0-9.^_-]{1,12}$/.test(symbol)) {
      return errorJson(`Invalid ticker: ${symbol}`, 400, symbol);
    }

    let yahooError: string | null = null;
    try {
      const quote = await fetchYahooQuote(symbol);
      return NextResponse.json({ ok: true as const, quote });
    } catch (err) {
      yahooError =
        err instanceof Error ? err.message : `Yahoo failed for ${symbol}.`;
    }

    try {
      const finnhub = await fetchFinnhubQuote(symbol);
      if (finnhub) {
        return NextResponse.json({ ok: true as const, quote: finnhub });
      }
    } catch (err) {
      const finnhubMsg =
        err instanceof Error ? err.message : 'Finnhub fallback failed.';
      return errorJson(
        yahooError
          ? `${yahooError} Finnhub: ${finnhubMsg}`
          : finnhubMsg,
        502,
        symbol
      );
    }

    return errorJson(yahooError ?? `No usable price for ${symbol}.`, 404, symbol);
  } catch (err) {
    console.error('Quote API error:', err);
    return errorJson(
      getErrorMessage(err, 'Unexpected quote service error.'),
      500
    );
  }
}
