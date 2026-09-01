/**
 * Approximate FX → USD for paper-trading consistency.
 * Rates are static fallbacks; live Yahoo FX is preferred when available.
 */

const STATIC_USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.66,
  HKD: 0.128,
  CNY: 0.14,
  CHF: 1.12,
  SGD: 0.75,
  KRW: 0.00074,
  TWD: 0.031,
  BRL: 0.18,
  MXN: 0.055,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  NZD: 0.6,
  ZAR: 0.055,
  PLN: 0.25,
};

const YAHOO_UA =
  'Mozilla/5.0 (compatible; PlayboltPaperTrading/0.2; +https://localhost)';

export function staticUsdRate(currency: string): number {
  const c = (currency || 'USD').toUpperCase();
  return STATIC_USD_PER_UNIT[c] ?? 1;
}

export function toUsd(amount: number, currency: string, rate?: number): number {
  const r = rate ?? staticUsdRate(currency);
  return amount * r;
}

/** Try Yahoo FX pair (e.g. EURUSD=X). Falls back to static table. */
export async function fetchUsdRate(currency: string): Promise<number> {
  const c = (currency || 'USD').toUpperCase();
  if (c === 'USD') return 1;

  try {
    const pair = `${c}USD=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      pair
    )}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return staticUsdRate(c);

    const payload = (await response.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const price = payload.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === 'number' && price > 0) return price;
  } catch {
    /* use static */
  }

  return staticUsdRate(c);
}
