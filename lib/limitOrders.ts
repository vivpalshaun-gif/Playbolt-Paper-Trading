import { getErrorMessage } from './errors';
import { requireSupabase } from './supabase';
import type { LimitOrder, Quote } from './types';

export async function fetchOpenLimitOrders(): Promise<LimitOrder[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('limit_orders')
    .select(
      'id, symbol, side, shares, limit_price, status, created_at, filled_at, filled_price'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LimitOrder[];
}

export async function placeLimitOrder(
  symbol: string,
  side: 'buy' | 'sell',
  shares: number,
  limitPrice: number
): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('place_limit_order', {
    p_symbol: symbol,
    p_side: side,
    p_shares: shares,
    p_limit_price: limitPrice,
  });

  if (error) {
    throw new Error(getErrorMessage(error, 'Could not place limit order.'));
  }

  return String(data);
}

export async function cancelLimitOrder(orderId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('cancel_limit_order', {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(getErrorMessage(error, 'Could not cancel limit order.'));
  }
}

export async function tryFillLimitOrder(
  orderId: string,
  marketPrice: number
): Promise<boolean> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('try_fill_limit_order', {
    p_order_id: orderId,
    p_market_price: marketPrice,
  });

  if (error) {
    // Expected failures (insufficient cash, etc.) — surface quietly to caller
    throw new Error(getErrorMessage(error, 'Could not fill limit order.'));
  }

  return Boolean(data);
}

/** Check open limit orders against live quotes and fill any that match. */
export async function checkAndFillLimitOrders(
  quotes: Map<string, Quote>
): Promise<number> {
  let filled = 0;
  let orders: LimitOrder[] = [];

  try {
    orders = await fetchOpenLimitOrders();
  } catch {
    // Table may not exist yet — skip silently
    return 0;
  }

  for (const order of orders) {
    const quote = quotes.get(order.symbol.toUpperCase());
    if (!quote || !(quote.price > 0)) continue;

    const side = String(order.side).toLowerCase();
    const limit = Number(order.limit_price);
    const market = quote.price;

    const match =
      (side === 'buy' && market <= limit) ||
      (side === 'sell' && market >= limit);

    if (!match) continue;

    try {
      const ok = await tryFillLimitOrder(order.id, market);
      if (ok) filled += 1;
    } catch {
      // Skip this order (e.g. insufficient cash) and continue
    }
  }

  return filled;
}
