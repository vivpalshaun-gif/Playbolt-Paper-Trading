'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toUserFacingApiError } from '@/lib/errors';
import { formatMoney, formatPct } from '@/lib/format';
import { getChartHistory, type ChartRange } from '@/lib/market';
import { usePortfolio } from './PortfolioProvider';

type ChartPoint = {
  time: number;
  date: string;
  price: number;
};

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
  { id: '1y', label: '1Y' },
  { id: 'max', label: 'Max' },
];

function formatAxisPrice(value: number) {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PriceChart() {
  const { holdings } = usePortfolio();
  const holdingSymbols = useMemo(
    () =>
      [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))],
    [holdings]
  );

  const defaultSymbol = holdingSymbols[0] || 'AAPL';
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [input, setInput] = useState(defaultSymbol);
  const [range, setRange] = useState<ChartRange>('1m');
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [name, setName] = useState<string | undefined>();
  const [change, setChange] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const [trendingUp, setTrendingUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!holdingSymbols.length) return;
    if (!holdingSymbols.includes(symbol)) {
      const next = holdingSymbols[0];
      setSymbol(next);
      setInput(next);
    }
    // Only sync when holdings first appear / change away from empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingSymbols.join(',')]);

  const loadChart = useCallback(async (sym: string, r: ChartRange) => {
    const normalized = sym.trim().toUpperCase();
    if (!normalized) {
      setError('Enter a ticker symbol (e.g. AAPL).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await getChartHistory(normalized, r);
      setPoints(payload.points);
      setName(payload.name);
      setChange(payload.change);
      setChangePercent(payload.changePercent);
      setTrendingUp(payload.trendingUp);
      setSymbol(payload.symbol);
      setInput(payload.symbol);
    } catch (err) {
      setPoints([]);
      setName(undefined);
      setChange(null);
      setChangePercent(null);
      setError(toUserFacingApiError(err, 'Could not load price history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChart(symbol, range);
  }, [symbol, range, loadChart]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (!next) {
      setError('Enter a ticker symbol (e.g. AAPL).');
      return;
    }
    setSymbol(next);
  }

  const stroke = trendingUp ? 'var(--ok)' : 'var(--error)';
  const fillId = trendingUp ? 'chartFillUp' : 'chartFillDown';
  const lastPrice = points.length ? points[points.length - 1].price : null;

  return (
    <div className="panel price-chart-panel">
      <div className="panel-head price-chart-head">
        <div>
          <h2>Price history</h2>
          <p className="muted panel-hint">
            {name ? `${name} · ` : ''}
            {symbol}
            {lastPrice != null ? ` · ${formatMoney(lastPrice)}` : ''}
          </p>
        </div>
        {change != null && changePercent != null ? (
          <p className={`price-chart-change ${trendingUp ? 'pl-up' : 'pl-down'}`}>
            {formatMoney(change)} ({formatPct(changePercent)})
          </p>
        ) : null}
      </div>

      <div className="price-chart-controls">
        <form className="price-chart-symbol" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="chart-symbol">
            Ticker
          </label>
          <input
            id="chart-symbol"
            className="chart-symbol-input"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Ticker"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Load
          </button>
        </form>

        {holdingSymbols.length ? (
          <div className="price-chart-holdings" role="group" aria-label="Holdings">
            {holdingSymbols.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip-btn ${s === symbol ? 'chip-btn-active' : ''}`}
                onClick={() => {
                  setSymbol(s);
                  setInput(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="price-chart-ranges" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`chip-btn ${r.id === range ? 'chip-btn-active' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="error banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="price-chart-canvas" aria-busy={loading}>
        {!mounted || (loading && !points.length) ? (
          <p className="muted chart-empty">
            {!mounted ? 'Preparing chart…' : 'Loading chart…'}
          </p>
        ) : points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartFillUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5ee0a0" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5ee0a0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="chartFillDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 6"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                minTickGap={48}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={formatAxisPrice}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--muted)', marginBottom: 4 }}
                formatter={(value: number) => [formatMoney(value), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: stroke }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : !error ? (
          <p className="muted chart-empty">No price history to show.</p>
        ) : null}
        {loading && points.length ? (
          <span className="chart-loading-badge muted">Updating…</span>
        ) : null}
      </div>
    </div>
  );
}
