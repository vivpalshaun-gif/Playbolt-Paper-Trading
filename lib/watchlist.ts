const STORAGE_KEY = 'paper-trading-watchlist';

export function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((s) => String(s ?? '').trim().toUpperCase())
          .filter(Boolean)
      ),
    ];
  } catch {
    return [];
  }
}

function saveWatchlist(symbols: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

export function addToWatchlist(symbol: string): string[] {
  const normalized = String(symbol ?? '')
    .trim()
    .toUpperCase();
  if (!normalized) return loadWatchlist();

  const list = loadWatchlist();
  if (!list.includes(normalized)) {
    list.push(normalized);
    saveWatchlist(list);
  }
  return list;
}

export function removeFromWatchlist(symbol: string): string[] {
  const normalized = String(symbol ?? '')
    .trim()
    .toUpperCase();
  const list = loadWatchlist().filter((s) => s !== normalized);
  saveWatchlist(list);
  return list;
}
