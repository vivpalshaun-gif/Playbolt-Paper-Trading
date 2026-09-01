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

/** Convert dollars → integer cents (banker's-safe via Math.round). */
export function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Round to whole cents (e.g. 37713.199999 → 37713.20). */
export function roundCents(amount: number): number {
  return fromCents(toCents(amount));
}

/**
 * Multiply quantity × unit price in cent space so
 * 70 * 538.76 === 37713.20 exactly (no float $0.01 drift).
 */
export function mulMoney(quantity: number, unitPrice: number): number {
  const unitCents = toCents(unitPrice);
  return Math.round(Number(quantity) * unitCents) / 100;
}

export function addMoney(...amounts: number[]): number {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0));
}

export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/** Treat near-zero share dust as closed (no active position). */
export function isActiveHolding(shares: number): boolean {
  return Number.isFinite(shares) && shares > 1e-8;
}

export function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(roundCents(amount));
  } catch {
    return currencyFmt.format(roundCents(amount));
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
    text: `${formatMoney(quote.change, 'USD')} (${formatPct(quote.changePercent)})`,
    cls: plClass(quote.change),
  };
}

export function enrichHoldings(
  holdings: Holding[],
  quoteMap: Map<string, Quote>,
  failMap: Map<string, string> = new Map()
): EnrichedHolding[] {
  const enriched = holdings
    .map((row) => {
      const shares = Number(row.shares);
      const avgCost = roundCents(Number(row.avg_cost));
      const quote = quoteMap.get(row.symbol) ?? null;
      const price =
        quote && typeof quote.price === 'number'
          ? roundCents(quote.price)
          : null;
      const marketValue =
        typeof price === 'number' ? mulMoney(shares, price) : null;
      const cost = mulMoney(shares, avgCost);
      const unrealized =
        marketValue != null ? subMoney(marketValue, cost) : null;
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
        exchange: quote?.exchange ?? quote?.country,
      };
    })
    .filter((row) => isActiveHolding(row.shares));

  return enriched.sort(
    (a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)
  );
}

export function summarizePortfolio(
  cash: number,
  holdings: Holding[],
  quoteMap: Map<string, Quote>
) {
  let costBasisCents = 0;
  let marketValueCents = 0;
  let missingQuotes = 0;

  const cashRounded = roundCents(cash);

  for (const row of holdings) {
    const shares = Number(row.shares);
    if (!isActiveHolding(shares)) continue;

    const avgCost = Number(row.avg_cost);
    costBasisCents += toCents(mulMoney(shares, avgCost));

    const quote = quoteMap.get(row.symbol);
    if (quote && typeof quote.price === 'number') {
      marketValueCents += toCents(mulMoney(shares, quote.price));
    } else {
      missingQuotes += 1;
    }
  }

  const costBasis = fromCents(costBasisCents);
  const marketValue = fromCents(marketValueCents);
  const netWorth = addMoney(cashRounded, marketValue);

  const unrealized =
    costBasis > 0 && missingQuotes === 0
      ? subMoney(marketValue, costBasis)
      : missingQuotes === 0 && costBasis === 0
        ? 0
        : null;
  const unrealizedPct =
    unrealized != null && costBasis > 0
      ? (unrealized / costBasis) * 100
      : null;

  const realized = subMoney(addMoney(cashRounded, costBasis), STARTING_CAPITAL);
  const accountPl =
    unrealized != null
      ? addMoney(realized, unrealized)
      : subMoney(netWorth, STARTING_CAPITAL);
  const accountReturnPct = (accountPl / STARTING_CAPITAL) * 100;

  return {
    cash: cashRounded,
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
