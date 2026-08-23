import type { EnrichedHolding, Holding, Quote } from './types';
import { STARTING_CAPITAL } from './types';

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const sharesFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
});

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const pctFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

export function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Number(amount));
  } catch {
    return currencyFmt.format(Number(amount));
  }
}

export function formatShares(shares: number) {
  return sharesFmt.format(shares);
}

export function formatPct(value: number) {
  return `${pctFmt.format(value)}%`;
}

export function formatDateTime(iso: string) {
  try {
    return dateTimeFmt.format(new Date(iso));
  } catch {
    return '—';
  }
}

export function plClass(value: number | null | undefined) {
  if (value == null) return '';
  if (value > 0) return 'pl-up';
  if (value < 0) return 'pl-down';
  return '';
}

export function formatDailyChange(quote: Quote | null | undefined) {
  if (!quote || quote.change == null || quote.changePercent == null) {
    return { text: '—', cls: '' };
  }
  return {
    text: `${formatMoney(quote.change, quote.currency)} (${formatPct(quote.changePercent)})`,
    cls: plClass(quote.change),
  };
}

export function enrichHoldings(
  holdings: Holding[],
  quoteMap: Map<string, Quote>,
  failMap: Map<string, string> = new Map()
): EnrichedHolding[] {
  const enriched = holdings.map((row) => {
    const shares = Number(row.shares);
    const avgCost = Number(row.avg_cost);
    const quote = quoteMap.get(row.symbol) ?? null;
    const price = quote?.price ?? null;
    const marketValue =
      typeof price === 'number' ? shares * price : null;
    const cost = shares * avgCost;
    const unrealized = marketValue != null ? marketValue - cost : null;
    const unrealizedPct =
      unrealized != null && cost > 0 ? (unrealized / cost) * 100 : null;

    return {
      symbol: row.symbol,
      shares,
      avgCost,
      price,
      marketValue,
      unrealized,
      unrealizedPct,
      quote,
      priceError: failMap.get(row.symbol),
    };
  });

  return enriched.sort(
    (a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)
  );
}

export function summarizePortfolio(
  cash: number,
  holdings: Holding[],
  quoteMap: Map<string, Quote>
) {
  let costBasis = 0;
  let marketValue = 0;
  let missingQuotes = 0;

  for (const row of holdings) {
    const shares = Number(row.shares);
    const avgCost = Number(row.avg_cost);
    costBasis += shares * avgCost;
    const quote = quoteMap.get(row.symbol);
    if (quote && typeof quote.price === 'number') {
      marketValue += shares * quote.price;
    } else {
      missingQuotes += 1;
    }
  }

  const netWorth = cash + marketValue;
  // Open positions only: mark − remaining cost basis (needs live quotes).
  const unrealized =
    costBasis > 0 && missingQuotes === 0 ? marketValue - costBasis : null;
  const unrealizedPct =
    unrealized != null && costBasis > 0
      ? (unrealized / costBasis) * 100
      : null;
  // Closed-trade P/L locked into cash. Identity (no quotes needed):
  //   cash + costBasis = STARTING_CAPITAL + realized
  //   netWorth = STARTING_CAPITAL + realized + unrealized
  //   (when all holdings are priced)
  const realized = cash + costBasis - STARTING_CAPITAL;
  const accountPl = netWorth - STARTING_CAPITAL;
  const accountReturnPct = (accountPl / STARTING_CAPITAL) * 100;

  return {
    cash,
    marketValue,
    netWorth,
    costBasis,
    unrealized,
    unrealizedPct,
    realized,
    accountPl,
    accountReturnPct,
    missingQuotes,
  };
}
