import type { Quote } from './types';
import { getErrorMessage } from './errors';

type QuoteApiSuccess = { ok: true; quote: Quote };
type QuoteApiError = { ok: false; error: string; symbol?: string };
type QuoteApiResponse = QuoteApiSuccess | QuoteApiError;

export type ChartRange = '1d' | '1w' | '1m' | '1y' | 'max';

export type ChartPoint = {
  time: number;
  date: string;
  price: number;
};

export type ChartHistory = {
  symbol: string;
  range: ChartRange;
  currency: string;
  name?: string;
  points: ChartPoint[];
  change: number;
  changePercent: number | null;
  trendingUp: boolean;
};

type ChartApiSuccess = { ok: true } & ChartHistory;
type ChartApiError = { ok: false; error: string; symbol?: string };
type ChartApiResponse = ChartApiSuccess | ChartApiError;

export async function getQuote(symbol: string): Promise<Quote> {
  const normalized = String(symbol ?? '')
    .trim()
    .toUpperCase();

  if (!normalized) {
    throw new Error('Enter a ticker symbol (e.g. AAPL).');
  }

  let response: Response;
  try {
    response = await fetch(`/api/quote?symbol=${encodeURIComponent(normalized)}`);
  } catch {
    throw new Error('Could not reach the quote API. Is the Next.js server running?');
  }

  let payload: QuoteApiResponse;
  try {
    payload = (await response.json()) as QuoteApiResponse;
  } catch {
    throw new Error(`Quote request failed (${response.status}). Try again.`);
  }

  if (!response.ok || !payload.ok) {
    const message =
      !payload.ok && payload.error
        ? payload.error
        : `Quote request failed (${response.status}). Try again.`;
    throw new Error(message);
  }

  return payload.quote;
}

export async function getChartHistory(
  symbol: string,
  range: ChartRange = '1m'
): Promise<ChartHistory> {
  const normalized = String(symbol ?? '')
    .trim()
    .toUpperCase();

  if (!normalized) {
    throw new Error('Enter a ticker symbol (e.g. AAPL).');
  }

  let response: Response;
  try {
    response = await fetch(
      `/api/chart?symbol=${encodeURIComponent(normalized)}&range=${encodeURIComponent(range)}`
    );
  } catch {
    throw new Error('Could not reach the chart API. Is the Next.js server running?');
  }

  let payload: ChartApiResponse;
  try {
    payload = (await response.json()) as ChartApiResponse;
  } catch {
    throw new Error(`Chart request failed (${response.status}). Try again.`);
  }

  if (!response.ok || !payload.ok) {
    const message =
      !payload.ok && payload.error
        ? payload.error
        : `Chart request failed (${response.status}). Try again.`;
    throw new Error(message);
  }

  return {
    symbol: payload.symbol,
    range: payload.range,
    currency: payload.currency,
    name: payload.name,
    points: payload.points,
    change: payload.change,
    changePercent: payload.changePercent,
    trendingUp: payload.trendingUp,
  };
}

export async function getQuotes(symbols: string[]) {
  const unique = [
    ...new Set(
      symbols
        .map((s) => String(s ?? '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  const quotes = new Map<string, Quote>();
  const failed: { symbol: string; message: string }[] = [];

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const quote = await getQuote(symbol);
        quotes.set(quote.symbol, quote);
      } catch (err) {
        failed.push({
          symbol,
          message: getErrorMessage(err, `No usable price for ${symbol}.`),
        });
      }
    })
  );

  return { quotes, failed };
}
