import { getErrorMessage } from './errors';

export const LOCAL_SERVER_DOWN_MESSAGE =
  'Unable to connect to local server. Please ensure your backend is running.';

export class ConnectionError extends Error {
  readonly code = 'CONNECTION_ERROR' as const;

  constructor(message = LOCAL_SERVER_DOWN_MESSAGE) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export function isConnectionError(err: unknown): boolean {
  if (err instanceof ConnectionError) return true;
  const msg = getErrorMessage(err, '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused') ||
    msg.includes('err_connection_refused') ||
    msg.includes('unable to connect to local server') ||
    msg.includes('could not reach') ||
    msg.includes('backend is running') ||
    msg.includes('next.js server')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchWithRetryOptions = RequestInit & {
  retries?: number;
  retryDelayMs?: number;
};

/**
 * fetch() with retries for network / 5xx failures.
 * Never throws Events — only Error / ConnectionError.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 2, retryDelayMs = 600, ...init } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, init);

      // Retry transient server errors
      if (response.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  if (isConnectionError(lastError)) {
    throw new ConnectionError();
  }

  throw new ConnectionError(
    getErrorMessage(lastError, LOCAL_SERVER_DOWN_MESSAGE)
  );
}
