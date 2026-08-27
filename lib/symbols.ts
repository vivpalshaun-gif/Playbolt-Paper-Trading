/** International ticker helpers: normalize, exchange tags, known ADRs. */

export type ExchangeMeta = {
  code: string; // short tag shown in UI: US, JP, IN, UK…
  label: string;
  currency: string; // typical listing currency (hint; live quote may override)
};

const SUFFIX_MAP: Record<string, ExchangeMeta> = {
  T: { code: 'JP', label: 'Tokyo', currency: 'JPY' },
  NS: { code: 'IN', label: 'NSE India', currency: 'INR' },
  BO: { code: 'IN', label: 'BSE India', currency: 'INR' },
  L: { code: 'UK', label: 'London', currency: 'GBP' },
  LON: { code: 'UK', label: 'London', currency: 'GBP' },
  TO: { code: 'CA', label: 'Toronto', currency: 'CAD' },
  V: { code: 'CA', label: 'TSX Venture', currency: 'CAD' },
  HK: { code: 'HK', label: 'Hong Kong', currency: 'HKD' },
  AX: { code: 'AU', label: 'Australia', currency: 'AUD' },
  DE: { code: 'DE', label: 'XETRA', currency: 'EUR' },
  F: { code: 'DE', label: 'Frankfurt', currency: 'EUR' },
  PA: { code: 'FR', label: 'Paris', currency: 'EUR' },
  AS: { code: 'NL', label: 'Amsterdam', currency: 'EUR' },
  SW: { code: 'CH', label: 'Swiss', currency: 'CHF' },
  SI: { code: 'SG', label: 'Singapore', currency: 'SGD' },
  KS: { code: 'KR', label: 'Korea', currency: 'KRW' },
  KQ: { code: 'KR', label: 'KOSDAQ', currency: 'KRW' },
  SS: { code: 'CN', label: 'Shanghai', currency: 'CNY' },
  SZ: { code: 'CN', label: 'Shenzhen', currency: 'CNY' },
  TW: { code: 'TW', label: 'Taiwan', currency: 'TWD' },
  SA: { code: 'BR', label: 'Sao Paulo', currency: 'BRL' },
  MX: { code: 'MX', label: 'Mexico', currency: 'MXN' },
};

/** Well-known US ADRs / dual listings (no suffix). */
const ADR_OR_US: Record<string, { name?: string; country: string }> = {
  SONY: { name: 'Sony Group', country: 'JP' },
  TM: { name: 'Toyota Motor', country: 'JP' },
  HMC: { name: 'Honda Motor', country: 'JP' },
  BABA: { name: 'Alibaba', country: 'CN' },
  JD: { name: 'JD.com', country: 'CN' },
  PDD: { name: 'PDD Holdings', country: 'CN' },
  NIO: { name: 'NIO', country: 'CN' },
  ASML: { name: 'ASML Holding', country: 'NL' },
  SHOP: { name: 'Shopify', country: 'CA' },
  SE: { name: 'Sea Limited', country: 'SG' },
  INFY: { name: 'Infosys', country: 'IN' },
  IBN: { name: 'ICICI Bank', country: 'IN' },
  HDB: { name: 'HDFC Bank', country: 'IN' },
  TSM: { name: 'TSMC', country: 'TW' },
  SAP: { name: 'SAP SE', country: 'DE' },
  NVO: { name: 'Novo Nordisk', country: 'DK' },
  UL: { name: 'Unilever', country: 'UK' },
  BP: { name: 'BP', country: 'UK' },
  RIO: { name: 'Rio Tinto', country: 'UK' },
  BTI: { name: 'British American Tobacco', country: 'UK' },
  DEO: { name: 'Diageo', country: 'UK' },
  SNY: { name: 'Sanofi', country: 'FR' },
  NVS: { name: 'Novartis', country: 'CH' },
  AZN: { name: 'AstraZeneca', country: 'UK' },
  GSK: { name: 'GSK', country: 'UK' },
  SNE: { name: 'Sony Group', country: 'JP' },
  MUFG: { name: 'Mitsubishi UFJ', country: 'JP' },
  TAK: { name: 'Takeda', country: 'JP' },
  WIT: { name: 'Wipro', country: 'IN' },
};

const US_META: ExchangeMeta = {
  code: 'US',
  label: 'United States',
  currency: 'USD',
};

/**
 * Normalize user input to a Yahoo-style ticker.
 * Accepts spaces, lower-case, and common suffixes (.T, .NS, .L, …).
 */
export function normalizeSymbol(raw: string): string {
  let s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  // Allow users to type 7203.T or 7203-T
  s = s.replace(/-/g, '.');

  // Strip leading $ if pasted from social apps
  if (s.startsWith('$')) s = s.slice(1);

  return s;
}

export function isValidSymbol(symbol: string): boolean {
  // Yahoo international: 7203.T, BRK.B, ^GSPC, etc.
  return /^[A-Z0-9][A-Z0-9.^_-]{0,19}$/.test(symbol);
}

export function getExchangeMeta(symbol: string): ExchangeMeta {
  const normalized = normalizeSymbol(symbol);
  const dot = normalized.lastIndexOf('.');
  if (dot > 0 && dot < normalized.length - 1) {
    const suffix = normalized.slice(dot + 1);
    if (SUFFIX_MAP[suffix]) return SUFFIX_MAP[suffix];
  }

  const adr = ADR_OR_US[normalized];
  if (adr) {
    return {
      code: 'US',
      label: `US ADR (${adr.country})`,
      currency: 'USD',
    };
  }

  return US_META;
}

export function getCountryTag(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  const adr = ADR_OR_US[normalized];
  if (adr) return 'US'; // ADR trades in USD on US exchanges
  return getExchangeMeta(normalized).code;
}

export function knownAdrHint(symbol: string): string | undefined {
  return ADR_OR_US[normalizeSymbol(symbol)]?.name;
}
