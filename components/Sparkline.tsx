'use client';

import { useEffect, useState } from 'react';
import { getChartHistory } from '@/lib/market';

type Props = {
  symbol: string;
  width?: number;
  height?: number;
};

/** Tiny 1W price sparkline for watchlist rows. */
export function Sparkline({ symbol, width = 88, height = 28 }: Props) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [up, setUp] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const history = await getChartHistory(symbol, '1w');
        if (cancelled || history.points.length < 2) {
          if (!cancelled) setPoints([]);
          return;
        }
        // Downsample for a light SVG
        const raw = history.points;
        const step = Math.max(1, Math.floor(raw.length / 24));
        const sampled = raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
        const prices = sampled.map((p) => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const span = max - min || 1;
        const coords = sampled.map((p, i) => ({
          x: (i / Math.max(1, sampled.length - 1)) * (width - 2) + 1,
          y: height - 2 - ((p.price - min) / span) * (height - 4),
        }));
        if (!cancelled) {
          setPoints(coords);
          setUp(history.trendingUp);
        }
      } catch {
        if (!cancelled) setPoints([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, width, height]);

  if (points.length < 2) {
    return (
      <span className="sparkline-empty muted" aria-hidden>
        ···
      </span>
    );
  }

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const color = up ? 'var(--ok)' : 'var(--error)';

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
