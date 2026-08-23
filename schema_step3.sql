-- Step 3: Portfolio / transaction-history verification (mostly no-op if Step 2 ran)
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
-- AFTER schema_step2.sql has already been applied.
--
-- Step 2 already created:
--   • public.transactions (id, user_id, symbol, side, shares, price, total, created_at)
--   • RLS SELECT for own rows
--   • buy_stock / sell_stock SECURITY DEFINER RPCs that INSERT trade rows
--
-- This script is idempotent: safe to re-run. It hardens transactions so
-- clients cannot INSERT directly (writes stay on the RPCs) and re-asserts
-- the read policy + index.

-- 1. Ensure table exists (no-op if Step 2 already created it)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  shares numeric not null check (shares > 0),
  price numeric not null check (price > 0),
  total numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_created_at_idx
  on public.transactions (user_id, created_at desc);

-- 2. RLS: users may SELECT their own rows only
alter table public.transactions enable row level security;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

-- Prefer inserts via buy_stock / sell_stock (SECURITY DEFINER), not the client.
-- Dropping this policy does not affect RPC inserts (definer bypasses RLS).
drop policy if exists "Users can insert own transactions" on public.transactions;

-- 3. Confirm RPCs still exist (raises if Step 2 was never applied)
do $$
begin
  if to_regprocedure('public.buy_stock(text, numeric, numeric)') is null then
    raise exception 'buy_stock missing — run schema_step2.sql first';
  end if;
  if to_regprocedure('public.sell_stock(text, numeric, numeric)') is null then
    raise exception 'sell_stock missing — run schema_step2.sql first';
  end if;
end;
$$;
