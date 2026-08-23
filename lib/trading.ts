import { getErrorMessage } from './errors';
import { formatMoney, formatShares } from './format';
import { requireSupabase } from './supabase';
import type { Holding, Transaction } from './types';

export async function fetchHoldings(): Promise<Holding[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('holdings')
    .select('id, symbol, shares, avg_cost, updated_at')
    .order('symbol', { ascending: true });

  if (error) {
    console.error('Failed to load holdings:', error.message);
    throw error;
  }

  return (data ?? []) as Holding[];
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, symbol, side, shares, price, total, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load transactions:', error.message);
    throw error;
  }

  return (data ?? []) as Transaction[];
}

function isExpectedTradeFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('insufficient cash') ||
    lower.includes('not enough shares') ||
    lower.includes('no holding') ||
    lower.includes('not authenticated') ||
    lower.includes('shares must be') ||
    lower.includes('price must be')
  );
}

function throwTradeError(error: unknown, action: 'Buy' | 'Sell'): never {
  const raw = getErrorMessage(error, `${action} failed`);
  const friendly = formatTradeError(error);

  // Expected business rejections (cash/shares) must not use console.error —
  // Next.js dev overlays treat console.error as a fatal "Console Error".
  if (!isExpectedTradeFailure(raw)) {
    console.warn(`${action} failed:`, raw);
  }

  throw new Error(friendly);
}

export async function buyStock(symbol: string, shares: number, price: number) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('buy_stock', {
    p_symbol: symbol,
    p_shares: shares,
    p_price: price,
  });

  if (error) {
    throwTradeError(error, 'Buy');
  }
}

export async function sellStock(symbol: string, shares: number, price: number) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('sell_stock', {
    p_symbol: symbol,
    p_shares: shares,
    p_price: price,
  });

  if (error) {
    throwTradeError(error, 'Sell');
  }
}

/** Client-side buy affordability check (avoids an unnecessary RPC). */
export function buyAffordabilityError(
  shares: number,
  price: number,
  cash: number | null
): string | null {
  if (cash == null || !Number.isFinite(cash)) return null;
  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  const cost = shares * price;
  if (cost > cash) {
    return `Not enough cash. Need ${formatMoney(cost)}, you have ${formatMoney(cash)}.`;
  }
  return null;
}

/** Client-side sell inventory check (avoids an unnecessary RPC). */
export function sellSharesError(
  shares: number,
  owned: number | null | undefined
): string | null {
  if (owned == null || !Number.isFinite(owned)) return null;
  if (!Number.isFinite(shares) || shares <= 0) return null;

  if (shares > owned) {
    return `Not enough shares. You own ${formatShares(owned)}.`;
  }
  return null;
}

/** Max whole/fractional shares affordable at the given price. */
export function maxAffordableShares(
  cash: number | null,
  price: number | null | undefined
): number | null {
  if (cash == null || price == null) return null;
  if (!Number.isFinite(cash) || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (cash <= 0) return 0;
  // Keep a sensible display precision without overselling float noise.
  return Math.floor((cash / price) * 1e4) / 1e4;
}

export function formatTradeError(err: unknown): string {
  const raw = getErrorMessage(err, 'Trade failed');
  const lower = raw.toLowerCase();

  if (lower.includes('insufficient cash')) {
    const match = raw.match(/need\s+([\d.]+).*have\s+([\d.]+)/i);
    if (match) {
      const need = Number(match[1]);
      const have = Number(match[2]);
      if (Number.isFinite(need) && Number.isFinite(have)) {
        return `Not enough cash. Need ${formatMoney(need)}, you have ${formatMoney(have)}.`;
      }
    }
    return 'Not enough cash for this purchase.';
  }
  if (lower.includes('not enough shares')) {
    return 'Not enough shares to sell.';
  }
  if (lower.includes('no holding')) {
    return 'You do not hold this ticker.';
  }
  if (lower.includes('not authenticated')) {
    return 'You must be signed in to trade.';
  }
  if (
    lower.includes('could not find the function') ||
    lower.includes('function public.buy_stock') ||
    lower.includes('function public.sell_stock')
  ) {
    return 'Trading is not set up yet. Run schema_step2.sql in the Supabase SQL Editor.';
  }
  if (
    lower.includes('schema cache') ||
    (lower.includes('relation') && lower.includes('holdings'))
  ) {
    return 'Holdings table missing. Run schema_step2.sql in the Supabase SQL Editor.';
  }
  if (lower.includes('relation') && lower.includes('transactions')) {
    return 'Transactions table missing. Run schema_step2.sql (then optionally schema_step3.sql) in the Supabase SQL Editor.';
  }

  return raw;
}
