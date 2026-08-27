import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';
import { fetchUsdRate, toUsd } from '@/lib/fx';
import { isValidSymbol, normalizeSymbol } from '@/lib/symbols';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YAHOO_UA =
  'Mozilla/5.0 (compatible; PlayboltPaperTrading/0.2; +https://localhost)';

export type ChartRange = '1d' | '1w' | '1m' | '1y' | 'max';

type ChartPoint = {
  time: number;
  date: string;
  price: number;
};

const RANGE_MAP: Record<
  ChartRange,
  { yahooRange?: string; interval: string; useFullHistory?: boolean }
> = {
  '1d': { yahooRange: '1d', interval: '5m' },
  '1w': { yahooRange: '5d', interval: '30m' },
  '1m': { yahooRange: '1mo', interval: '1d' },
  '1y': { yahooRange: '1y', interval: '1d' },
  max: { interval: '1mo', useFullHistory: true },
};

function errorJson(message: string, status = 400, symbol?: string) {
  return NextResponse.json(
    { ok: false as const, error: message, symbol },
    { status }
  );
}

function formatLabel(tsSeconds: number, range: ChartRange): string {
  const d = new Date(tsSeconds * 1000);
  if (Number.isNaN(d.getTime())) return '';

  if (range === '1d') {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (range === '1w') {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (range === 'max') {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
    });
  }

  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parseChartPayload(
  payload: unknown,
  normalized: string,
  range: ChartRange
): { points: ChartPoint[]; currency: string; name?: string } {
  const chart = (
    payload as {
      chart?: {
        result?: unknown[];
        error?: { description?: string };
      };
    }
  )?.chart;
  const result = chart?.result?.[0] as
    | {
        meta?: Record<string, unknown>;
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }
    | undefined;
  const errorDescription = chart?.error?.description;

  if (!result) {
    throw new Error(
      errorDescription ||
        `No chart data for ${normalized}. Check the ticker and try again.`
    );
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: ChartPoint[] = [];

  const len = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < len; i++) {
    const close = closes[i];
    const ts = timestamps[i];
    if (typeof close !== 'number' || Number.isNaN(close) || close <= 0) continue;
    if (typeof ts !== 'number' || Number.isNaN(ts)) continue;
    points.push({
      time: ts,
      date: formatLabel(ts, range),
      price: close,
    });
  }

  if (!points.length) {
    throw new Error(`No usable price history for ${normalized}.`);
  }

  const meta = result.meta ?? {};
  return {
    points,
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    name:
      (typeof meta.longName === 'string' && meta.longName) ||
      (typeof meta.shortName === 'string' && meta.shortName) ||
      undefined,
  };
}

async function fetchYahooHistory(symbol: string, range: ChartRange) {
  const config = RANGE_MAP[range];
  let url: string;

  if (config.useFullHistory) {
    const period2 = Math.floor(Date.now() / 1000);
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?period1=0&period2=${period2}&interval=${encodeURIComponent(config.interval)}`;
  } else {
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=${encodeURIComponent(config.interval)}&range=${encodeURIComponent(
      config.yahooRange!
    )}`;
  }

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
    throw new Error(`Yahoo chart request failed (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Yahoo returned invalid chart data for ${symbol}.`);
  }

  return parseChartPayload(payload, symbol, range);
}

async function toUsdPoints(
  points: ChartPoint[],
  currency: string
): Promise<ChartPoint[]> {
  if ((currency || 'USD').toUpperCase() === 'USD') return points;
  const rate = await fetchUsdRate(currency);
  return points.map((p) => ({
    ...p,
    price: Math.round(toUsd(p.price, currency, rate) * 100) / 100,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = normalizeSymbol(searchParams.get('symbol') ?? '');
    const rangeRaw = (searchParams.get('range') ?? '1m').trim().toLowerCase();
    const range = (rangeRaw === 'all' ? 'max' : rangeRaw) as ChartRange;

    if (!symbol) {
      return errorJson('Enter a ticker symbol (e.g. AAPL or 7203.T).', 400);
    }

    if (!isValidSymbol(symbol)) {
      return errorJson(`Invalid ticker: ${symbol}`, 400, symbol);
    }

    if (!(range in RANGE_MAP)) {
      return errorJson(
        'Invalid range. Use 1d, 1w, 1m, 1y, or max.',
        400,
        symbol
      );
    }

    try {
      const { points: nativePoints, currency, name } = await fetchYahooHistory(
        symbol,
        range
      );
      const points = await toUsdPoints(nativePoints, currency);
      const first = points[0]?.price ?? 0;
      const last = points[points.length - 1]?.price ?? 0;
      const change = last - first;
      const changePercent = first > 0 ? (change / first) * 100 : null;

      return NextResponse.json({
        ok: true as const,
        symbol,
        range,
        currency: 'USD',
        name,
        points,
        change,
        changePercent,
        trendingUp: last >= first,
        simulated: false,
      });
    } catch (err) {
      return errorJson(
        getErrorMessage(
          err,
          'Invalid stock ticker. Please check the symbol and try again.'
        ),
        404,
        symbol
      );
    }
  } catch (err) {
    console.error('Chart API error:', err);
    return errorJson(
      getErrorMessage(err, 'Unexpected chart service error.'),
      500
    );
  }
}
