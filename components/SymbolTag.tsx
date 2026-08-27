'use client';

import { getCountryTag } from '@/lib/symbols';

export function SymbolTag({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange?: string | null;
}) {
  const tag = (exchange || getCountryTag(symbol)).toUpperCase();
  return (
    <span className="exchange-tag" title={`${tag} listing / ADR`}>
      {tag}
    </span>
  );
}

export function SymbolCell({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange?: string | null;
}) {
  return (
    <span className="symbol-cell">
      <span className="symbol-text">{symbol}</span>
      <SymbolTag symbol={symbol} exchange={exchange} />
    </span>
  );
}
