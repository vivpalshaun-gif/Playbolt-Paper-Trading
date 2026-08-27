import { requireSupabase } from './supabase';

export async function signInWithGoogle() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) {
    console.error('Google sign-in failed:', error.message);
    throw error;
  }

  return data;
}

export async function getSignOut() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign-out failed:', error.message);
    throw error;
  }
}

export function onAuthStateChange(
  onChange: (session: import('@supabase/supabase-js').Session | null) => void
) {
  const supabase = requireSupabase();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });

  return () => subscription.unsubscribe();
}

export async function fetchProfile(userId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('cash_balance, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to load profile:', error.message);
    throw error;
  }

  return data;
}
