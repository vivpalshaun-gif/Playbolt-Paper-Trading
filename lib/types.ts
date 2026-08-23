export type Quote = {
  symbol: string;
  price: number;
  currency: string;
  name?: string;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: string | null;
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
};

export const STARTING_CAPITAL = 100_000;
