/**
 * Safely extract a user-facing message from unknown thrown values.
 * Never stringifies DOM Events / plain objects (avoids "[object Event]").
 */
export function getErrorMessage(
  err: unknown,
  fallback = 'An error occurred'
): string {
  if (err instanceof Error) {
    const msg = err.message?.trim();
    return msg || fallback;
  }

  if (typeof err === 'string') {
    const msg = err.trim();
    return msg || fallback;
  }

  // DOM Events / SyntheticEvents — never surface as "[object Event]"
  if (typeof Event !== 'undefined' && err instanceof Event) {
    return fallback;
  }

  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }

  return fallback;
}
