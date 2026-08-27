import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function resolveSupabaseEnv() {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';
    return { url: url.trim(), anonKey: anonKey.trim() };
  } catch {
    return { url: '', anonKey: '' };
  }
}

/** undefined = not initialized yet; null = missing/failed; client = ready */
let client: SupabaseClient | null | undefined;

function initClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const { url, anonKey } = resolveSupabaseEnv();

  if (!url || !anonKey) {
    // Soft fail: never throw at import/build time when env is absent (e.g. Vercel CI).
    console.error(
      'Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY) in .env.local / Vercel.'
    );
    client = null;
    return client;
  }

  try {
    client = createClient(url, anonKey);
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    client = null;
  }

  return client;
}

/**
 * Lazy accessor — does not initialize until first call.
 * Prefer requireSupabase() / hasSupabaseConfig() in app code.
 */
export function getSupabase(): SupabaseClient | null {
  try {
    return initClient();
  } catch {
    return null;
  }
}

export function hasSupabaseConfig() {
  try {
    return initClient() !== null;
  } catch {
    return false;
  }
}

/** Use in call sites that need a live client; throws a controlled Error (not process crash). */
export function requireSupabase(): SupabaseClient {
  const resolved = initClient();
  if (!resolved) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (or Vercel env).'
    );
  }
  return resolved;
}
