import { isConnectionError } from './http';

export type ApiConnectionStatus = 'online' | 'reconnecting' | 'offline';

export const SERVER_DISCONNECTED_MESSAGE = 'Server disconnected. Retrying…';
export const SERVER_RECONNECTED_MESSAGE = 'Server reconnected.';

type StatusListener = (
  status: ApiConnectionStatus,
  previous: ApiConnectionStatus
) => void;

let currentStatus: ApiConnectionStatus = 'online';
const listeners = new Set<StatusListener>();

export function getApiConnectionStatus(): ApiConnectionStatus {
  return currentStatus;
}

export function subscribeApiStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStatus(next: ApiConnectionStatus) {
  if (next === currentStatus) return;
  const prev = currentStatus;
  currentStatus = next;
  for (const listener of listeners) {
    try {
      listener(next, prev);
    } catch {
      // ignore listener errors
    }
  }
}

/** Call when a request succeeds after a prior failure. */
export function reportApiSuccess() {
  setStatus('online');
}

/** Call on the first retry attempt or when a transient failure is detected. */
export function reportApiReconnecting() {
  if (currentStatus === 'online') {
    setStatus('reconnecting');
  }
}

/** Call when all retries are exhausted or the server is unreachable. */
export function reportApiFailure(err?: unknown) {
  if (err != null && !isConnectionError(err)) return;
  setStatus(currentStatus === 'reconnecting' ? 'offline' : 'reconnecting');
}

/** Classify HTTP status codes that indicate a backend problem (not invalid tickers). */
export function isServerErrorStatus(status: number): boolean {
  return status === 404 || status >= 500;
}
