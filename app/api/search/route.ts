import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errors';
import {
  getCountryTag,
  isValidSymbol,
  normalizeSymbol,
} from '@/lib/symbols';
import type { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YAHOO_UA =
  'Mozilla/5.0 (compatible; PlayboltPaperTrading/0.2; +https://localhost)';

const LOCAL_HINTS: SearchResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'US', country: 'US' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'US', country: 'US' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'US', country: 'US' },
  { symbol: 'SONY', name: 'Sony Group ADR', exchange: 'US', country: 'US' },
  { symbol: 'TM', name: 'Toyota Motor ADR', exchange: 'US', country: 'US' },
  { symbol: 'BABA', name: 'Alibaba ADR', exchange: 'US', country: 'US' },
  { symbol: 'ASML', name: 'ASML Holding ADR', exchange: 'US', country: 'US' },
  { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'US', country: 'US' },
  { symbol: '7203.T', name: 'Toyota Motor (Tokyo)', exchange: 'JP', country: 'JP' },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', exchange: 'IN', country: 'IN' },
  { symbol: 'BP.L', name: 'BP PLC (London)', exchange: 'UK', country: 'UK' },
  { symbol: 'SAP.DE', name: 'SAP SE (XETRA)', exchange: 'DE', country: 'DE' },
  { symbol: 'INFY', name: 'Infosys ADR', exchange: 'US', country: 'US' },
  { symbol: 'TSM', name: 'TSMC ADR', exchange: 'US', country: 'US' },
  { symbol: 'NVO', name: 'Novo Nordisk ADR', exchange: 'US', country: 'US' },
  { symbol: 'NESN.SW', name: 'Nestlé (Swiss)', exchange: 'CH', country: 'CH' },
];

function mapExchangeToCountry(ex: string | undefined): string {
  if (!ex) return 'US';
  const u = ex.toUpperCase();
  if (u.includes('NMS') || u.includes('NYQ') || u.includes('NGM') || u === 'NMS')
    return 'US';
  if (u.includes('TYO') || u.includes('JP')) return 'JP';
  if (u.includes('NSI') || u.includes('BSE') || u.includes('NSE')) return 'IN';
  if (u.includes('LSE') || u.includes('LON')) return 'UK';
  if (u.includes('TOR') || u.includes('TSX')) return 'CA';
  if (u.includes('HKG')) return 'HK';
  if (u.includes('ASX')) return 'AU';
  if (u.includes('GER') || u.includes('FRA') || u.includes('XETRA')) return 'DE';
  if (u.includes('PAR')) return 'FR';
  if (u.includes('AMS')) return 'NL';
  return getCountryTag(ex.includes('.') ? ex : 'AAPL');
}

export async function GET(request: Request) {
  try {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (!q || q.length < 1) {
      return NextResponse.json({
        ok: true as const,
        results: LOCAL_HINTS.slice(0, 8),
      });
    }

    const normalized = normalizeSymbol(q);
    const local = LOCAL_HINTS.filter(
      (r) =>
        r.symbol.includes(normalized) ||
        r.name.toUpperCase().includes(q.toUpperCase())
    );

    let remote: SearchResult[] = [];
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=10&newsCount=0`;
      const response = await fetch(url, {
        headers: { 'User-Agent': YAHOO_UA, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          quotes?: {
            symbol?: string;
            shortname?: string;
            longname?: string;
            exchange?: string;
            quoteType?: string;
          }[];
        };
        remote = (payload.quotes ?? [])
          .filter((row) => row.symbol && isValidSymbol(normalizeSymbol(row.symbol)))
          .filter((row) => {
            const t = (row.quoteType ?? '').toUpperCase();
            return !t || t === 'EQUITY' || t === 'ETF' || t === 'ADR';
          })
          .map((row) => {
            const symbol = normalizeSymbol(row.symbol!);
            const country = symbol.includes('.')
              ? getCountryTag(symbol)
              : mapExchangeToCountry(row.exchange);
            return {
              symbol,
              name: row.longname || row.shortname || symbol,
              exchange: country,
              country,
              type: row.quoteType,
            };
          });
      }
    } catch {
      /* local hints only */
    }

    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const row of [...local, ...remote]) {
      if (seen.has(row.symbol)) continue;
      seen.add(row.symbol);
      results.push(row);
      if (results.length >= 12) break;
    }

    // Do not invent unverified tickers — only Yahoo / curated hints
    return NextResponse.json({ ok: true as const, results });
  } catch (err) {
    return NextResponse.json({
      ok: true as const,
      results: LOCAL_HINTS.slice(0, 8),
      warning: getErrorMessage(err, 'Search degraded to local hints.'),
    });
  }
}
