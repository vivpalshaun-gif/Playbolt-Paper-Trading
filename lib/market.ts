import type { Quote, SearchResult } from './types';
import { getErrorMessage } from './errors';
import {
  ConnectionError,
  fetchWithRetry,
  isConnectionError,
  LOCAL_SERVER_DOWN_MESSAGE,
} from './http';
import { reportApiFailure, reportApiReconnecting } from './apiStatus';
import { isValidSymbol, normalizeSymbol } from './symbols';

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
  simulated?: boolean;
};

type ChartApiSuccess = { ok: true } & ChartHistory;
type ChartApiError = { ok: false; error: string; symbol?: string };
type ChartApiResponse = ChartApiSuccess | ChartApiError;

export const INVALID_TICKER_MESSAGE =
  'Invalid stock ticker. Please check the symbol and try again.';

export { LOCAL_SERVER_DOWN_MESSAGE, isConnectionError, ConnectionError };

/**
 * Fetch a live USD quote. Throws on invalid / not-found tickers —
 * never invents simulated prices for fake symbols.
 */
export async function getQuote(symbol: string): Promise<Quote> {
  const normalized = normalizeSymbol(symbol);

  if (!normalized) {
    throw new Error('Enter a ticker (e.g. AAPL, SONY, 7203.T).');
  }

  if (!isValidSymbol(normalized)) {
    throw new Error(INVALID_TICKER_MESSAGE);
  }

  let response: Response;
  try {
    response = await fetchWithRetry(
      `/api/quote?symbol=${encodeURIComponent(normalized)}`
    );
  } catch (err) {
    if (isConnectionError(err)) throw new ConnectionError();
    throw new ConnectionError(
      getErrorMessage(err, LOCAL_SERVER_DOWN_MESSAGE)
    );
  }

  if (response.status >= 500) {
    throw new ConnectionError();
  }

  let payload: QuoteApiResponse;
  try {
    payload = (await response.json()) as QuoteApiResponse;
  } catch {
    if (!response.ok) throw new ConnectionError();
    throw new Error(INVALID_TICKER_MESSAGE);
  }

  if (!response.ok || !payload.ok) {
    const raw =
      !payload.ok && payload.error
        ? payload.error
        : INVALID_TICKER_MESSAGE;
    const lower = raw.toLowerCase();
    if (
      response.status === 404 ||
      lower.includes('invalid') ||
      lower.includes('not found') ||
      lower.includes('no usable')
    ) {
      throw new Error(INVALID_TICKER_MESSAGE);
    }
    if (response.status >= 500 || isConnectionError(raw)) {
      throw new ConnectionError();
    }
    throw new Error(getErrorMessage(raw, INVALID_TICKER_MESSAGE));
  }

  if (!payload.quote || !(payload.quote.price > 0) || payload.quote.simulated) {
    throw new Error(INVALID_TICKER_MESSAGE);
  }

  return { ...payload.quote, symbol: payload.quote.symbol || normalized };
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const q = String(query ?? '').trim();
  if (!q) return [];

  try {
    const response = await fetchWithRetry(
      `/api/search?q=${encodeURIComponent(q)}`,
      { retries: 1 }
    );
    if (response.status >= 500) {
      throw new ConnectionError();
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      results?: SearchResult[];
    };
    return Array.isArray(payload.results) ? payload.results : [];
  } catch (err) {
    if (isConnectionError(err)) throw new ConnectionError();
    return [];
  }
}

export async function getChartHistory(
  symbol: string,
  range: ChartRange = '1m'
): Promise<ChartHistory> {
  const normalized = normalizeSymbol(symbol);

  if (!normalized) {
    throw new Error('Enter a ticker symbol (e.g. AAPL).');
  }

  let response: Response;
  try {
    response = await fetchWithRetry(
      `/api/chart?symbol=${encodeURIComponent(normalized)}&range=${encodeURIComponent(range)}`
    );
  } catch (err) {
    if (isConnectionError(err)) throw new ConnectionError();
    throw new ConnectionError(
      getErrorMessage(err, LOCAL_SERVER_DOWN_MESSAGE)
    );
  }

  if (response.status >= 500) {
    throw new ConnectionError();
  }

  let payload: ChartApiResponse;
  try {
    payload = (await response.json()) as ChartApiResponse;
  } catch {
    throw new ConnectionError();
  }

  if (!response.ok || !payload.ok || !payload.points?.length) {
    const raw =
      !payload.ok && payload.error
        ? payload.error
        : INVALID_TICKER_MESSAGE;
    if (response.status >= 500 || isConnectionError(raw)) {
      throw new ConnectionError();
    }
    throw new Error(getErrorMessage(raw, INVALID_TICKER_MESSAGE));
  }

  if (payload.simulated) {
    throw new Error(INVALID_TICKER_MESSAGE);
  }

  return {
    symbol: payload.symbol,
    range: payload.range,
    currency: payload.currency || 'USD',
    name: payload.name,
    points: payload.points,
    change: payload.change,
    changePercent: payload.changePercent,
    trendingUp: payload.trendingUp,
    simulated: false,
  };
}

export async function getQuotes(symbols: string[]) {
  const unique = [
    ...new Set(
      symbols.map((s) => normalizeSymbol(s)).filter((s) => s && isValidSymbol(s))
    ),
  ];

  const quotes = new Map<string, Quote>();
  const failed: { symbol: string; message: string }[] = [];
  let connectionFailed = false;

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const quote = await getQuote(symbol);
        quotes.set(symbol, quote);
        if (quote.symbol && quote.symbol !== symbol) {
          quotes.set(quote.symbol, quote);
        }
      } catch (err) {
        if (isConnectionError(err)) {
          connectionFailed = true;
        }
        failed.push({
          symbol,
          message: getErrorMessage(
            err,
            isConnectionError(err)
              ? LOCAL_SERVER_DOWN_MESSAGE
              : INVALID_TICKER_MESSAGE
          ),
        });
      }
    })
  );

  if (connectionFailed) {
    if (quotes.size === 0 && unique.length > 0) {
      reportApiFailure();
      throw new ConnectionError();
    }
    reportApiReconnecting();
  }

  return { quotes, failed };
}
