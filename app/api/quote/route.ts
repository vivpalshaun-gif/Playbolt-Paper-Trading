import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';
import { fetchUsdRate, toUsd } from '@/lib/fx';
import {
  getCountryTag,
  getExchangeMeta,
  isValidSymbol,
  knownAdrHint,
  normalizeSymbol,
} from '@/lib/symbols';
import type { Quote } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YAHOO_UA =
  'Mozilla/5.0 (compatible; PlayboltPaperTrading/0.2; +https://localhost)';

const INVALID_TICKER =
  'Invalid stock ticker. Please check the symbol and try again.';

function okQuote(quote: Quote) {
  return NextResponse.json({ ok: true as const, quote });
}

function failQuote(message: string, status: number, symbol?: string) {
  return NextResponse.json(
    { ok: false as const, error: message, symbol },
    { status }
  );
}

async function enrichWithUsd(quote: Quote): Promise<Quote> {
  const nativeCurrency = (
    quote.nativeCurrency ||
    quote.currency ||
    'USD'
  ).toUpperCase();
  const nativePrice = quote.nativePrice ?? quote.price;
  const exchange = quote.exchange ?? getCountryTag(quote.symbol);
  const meta = getExchangeMeta(quote.symbol);

  if (nativeCurrency === 'USD') {
    return {
      ...quote,
      price: nativePrice,
      currency: 'USD',
      nativePrice,
      nativeCurrency: 'USD',
      exchange,
      country: quote.country ?? exchange,
      fxRate: 1,
      simulated: false,
      name: quote.name || knownAdrHint(quote.symbol) || meta.label,
    };
  }

  const rate = await fetchUsdRate(nativeCurrency);
  const price = Math.round(toUsd(nativePrice, nativeCurrency, rate) * 100) / 100;
  const previousClose =
    quote.previousClose != null
      ? Math.round(toUsd(quote.previousClose, nativeCurrency, rate) * 100) / 100
      : null;
  const change =
    previousClose != null ? price - previousClose : quote.change;
  const changePercent =
    previousClose != null && previousClose > 0
      ? (change! / previousClose) * 100
      : quote.changePercent;

  return {
    ...quote,
    price,
    currency: 'USD',
    nativePrice,
    nativeCurrency,
    previousClose,
    change,
    changePercent,
    exchange,
    country: quote.country ?? exchange,
    fxRate: rate,
    simulated: false,
    name: quote.name || knownAdrHint(quote.symbol),
  };
}

function parseYahooChart(payload: unknown, normalized: string): Quote {
  const chart = (
    payload as {
      chart?: { result?: unknown[]; error?: { description?: string } };
    }
  )?.chart;
  const result = chart?.result?.[0] as
    | {
        meta?: Record<string, unknown>;
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }
    | undefined;
  const errorDescription = chart?.error?.description;

  if (!result) {
    throw new Error(errorDescription || INVALID_TICKER);
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
    throw new Error(INVALID_TICKER);
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

  const currency =
    typeof meta.currency === 'string' ? meta.currency.toUpperCase() : 'USD';
  const symbol =
    typeof meta.symbol === 'string' ? meta.symbol.toUpperCase() : normalized;

  return {
    symbol,
    price,
    currency,
    nativePrice: price,
    nativeCurrency: currency,
    name:
      (typeof meta.longName === 'string' && meta.longName) ||
      (typeof meta.shortName === 'string' && meta.shortName) ||
      knownAdrHint(normalized) ||
      undefined,
    previousClose,
    change,
    changePercent,
    marketState:
      typeof meta.marketState === 'string' ? meta.marketState : null,
    exchange: getCountryTag(symbol),
    country: getCountryTag(symbol),
    simulated: false,
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
    throw new Error(`Could not reach market data for ${symbol}. Try again.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(INVALID_TICKER);
    }
    throw new Error(`Market data request failed (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(INVALID_TICKER);
  }

  return parseYahooChart(payload, symbol);
}

async function fetchFinnhubQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  if (symbol.includes('.')) return null;

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
    return null;
  }

  if (!quoteRes.ok) return null;

  let quoteData: { c?: number; pc?: number; d?: number; dp?: number };
  try {
    quoteData = (await quoteRes.json()) as {
      c?: number;
      pc?: number;
      d?: number;
      dp?: number;
    };
  } catch {
    return null;
  }
  const price = quoteData.c;
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
    return null;
  }

  let name: string | undefined;
  if (profileRes.ok) {
    try {
      const profile = (await profileRes.json()) as { name?: string };
      if (profile.name) name = profile.name;
    } catch {
      /* ignore */
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
    nativePrice: price,
    nativeCurrency: 'USD',
    name: name || knownAdrHint(symbol),
    previousClose,
    change,
    changePercent,
    marketState: null,
    exchange: getCountryTag(symbol),
    country: getCountryTag(symbol),
    simulated: false,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = normalizeSymbol(searchParams.get('symbol') ?? '');

    if (!symbol) {
      return failQuote('Enter a ticker (e.g. AAPL, SONY, 7203.T).', 400);
    }

    if (!isValidSymbol(symbol)) {
      return failQuote(INVALID_TICKER, 400, symbol);
    }

    let lastError = INVALID_TICKER;

    try {
      const raw = await fetchYahooQuote(symbol);
      const quote = await enrichWithUsd(raw);
      return okQuote(quote);
    } catch (err) {
      lastError = getErrorMessage(err, INVALID_TICKER);
    }

    try {
      const finnhub = await fetchFinnhubQuote(symbol);
      if (finnhub) {
        const quote = await enrichWithUsd(finnhub);
        return okQuote(quote);
      }
    } catch (err) {
      lastError = getErrorMessage(err, lastError);
    }

    // Never invent prices for missing / invalid tickers
    const status =
      lastError === INVALID_TICKER ||
      lastError.toLowerCase().includes('not found') ||
      lastError.toLowerCase().includes('invalid')
        ? 404
        : 502;
    return failQuote(
      status === 404 ? INVALID_TICKER : lastError,
      status,
      symbol
    );
  } catch (err) {
    return failQuote(
      getErrorMessage(err, 'Unexpected quote service error.'),
      500
    );
  }
}
