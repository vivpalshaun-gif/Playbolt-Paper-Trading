export type Quote = {
  symbol: string;
  /** Trading price in USD (always used for cash / portfolio math). */
  price: number;
  /** Always USD after conversion for portfolio consistency. */
  currency: string;
  /** Price in listing currency before FX (if different). */
  nativePrice?: number;
  nativeCurrency?: string;
  name?: string;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: string | null;
  /** Country / exchange tag: US, JP, IN, UK… */
  exchange?: string;
  country?: string;
  /** True when live APIs failed and a simulated quote was used. */
  simulated?: boolean;
  fxRate?: number;
};

export type Holding = {
  id: string;
  symbol: string;
  shares: number;
  avg_cost: number;
  updated_at?: string;
};

export type Transaction = {
  id: string;
  symbol: string;
  side: string;
  shares: number;
  price: number;
  total: number;
  created_at: string;
};

export type Profile = {
  cash_balance: number;
  created_at?: string;
};

export type LimitOrder = {
  id: string;
  symbol: string;
  side: string;
  shares: number;
  limit_price: number;
  status: string;
  created_at: string;
  filled_at?: string | null;
  filled_price?: number | null;
};

export type EnrichedHolding = {
  symbol: string;
  shares: number;
  avgCost: number;
  price: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  quote: Quote | null;
  priceError?: string;
  exchange?: string;
};

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type?: string;
};

export const STARTING_CAPITAL = 100_000;
