-- Step 2: Holdings, optional trade history, RLS, and atomic buy/sell RPCs
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
-- AFTER schema_step1.sql has already been applied.

-- 1. Holdings: one row per (user, symbol)
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  shares numeric not null check (shares > 0),
  avg_cost numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

-- 2. Transactions: audit trail of buys and sells
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

-- 3. Row Level Security — users only touch their own rows
alter table public.holdings enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users can read own holdings" on public.holdings;
create policy "Users can read own holdings"
  on public.holdings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own holdings" on public.holdings;
create policy "Users can insert own holdings"
  on public.holdings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own holdings" on public.holdings;
create policy "Users can update own holdings"
  on public.holdings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own holdings" on public.holdings;
create policy "Users can delete own holdings"
  on public.holdings
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

-- 4. Atomic buy: deduct cash, upsert holding (weighted avg cost), log transaction
create or replace function public.buy_stock(
  p_symbol text,
  p_shares numeric,
  p_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_symbol text := upper(trim(p_symbol));
  v_cash numeric;
  v_cost numeric;
  v_existing public.holdings%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_symbol is null or v_symbol = '' then
    raise exception 'Symbol is required';
  end if;

  if p_shares is null or p_shares <= 0 then
    raise exception 'Shares must be greater than 0';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than 0';
  end if;

  v_cost := p_shares * p_price;

  -- Lock the profile row so concurrent trades cannot overspend
  select cash_balance into v_cash
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_cash < v_cost then
    raise exception 'Insufficient cash: need %, have %', v_cost, v_cash;
  end if;

  update public.profiles
  set cash_balance = cash_balance - v_cost
  where id = v_uid;

  select * into v_existing
  from public.holdings
  where user_id = v_uid and symbol = v_symbol
  for update;

  if found then
    update public.holdings
    set
      shares = v_existing.shares + p_shares,
      avg_cost = (
        (v_existing.shares * v_existing.avg_cost) + v_cost
      ) / (v_existing.shares + p_shares),
      updated_at = now()
    where id = v_existing.id;
  else
    insert into public.holdings (user_id, symbol, shares, avg_cost)
    values (v_uid, v_symbol, p_shares, p_price);
  end if;

  insert into public.transactions (user_id, symbol, side, shares, price, total)
  values (v_uid, v_symbol, 'buy', p_shares, p_price, v_cost);
end;
$$;

-- 5. Atomic sell: credit cash, reduce/delete holding, log transaction
create or replace function public.sell_stock(
  p_symbol text,
  p_shares numeric,
  p_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_symbol text := upper(trim(p_symbol));
  v_proceeds numeric;
  v_holding public.holdings%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_symbol is null or v_symbol = '' then
    raise exception 'Symbol is required';
  end if;

  if p_shares is null or p_shares <= 0 then
    raise exception 'Shares must be greater than 0';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than 0';
  end if;

  -- Ensure profile exists and lock it with the holding update
  perform 1 from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  select * into v_holding
  from public.holdings
  where user_id = v_uid and symbol = v_symbol
  for update;

  if not found then
    raise exception 'No holding for %', v_symbol;
  end if;

  if v_holding.shares < p_shares then
    raise exception 'Not enough shares: have %, tried to sell %',
      v_holding.shares, p_shares;
  end if;

  v_proceeds := p_shares * p_price;

  update public.profiles
  set cash_balance = cash_balance + v_proceeds
  where id = v_uid;

  if v_holding.shares = p_shares then
    delete from public.holdings where id = v_holding.id;
  else
    update public.holdings
    set
      shares = v_holding.shares - p_shares,
      updated_at = now()
    where id = v_holding.id;
  end if;

  insert into public.transactions (user_id, symbol, side, shares, price, total)
  values (v_uid, v_symbol, 'sell', p_shares, p_price, v_proceeds);
end;
$$;

-- 6. Execute privileges: only authenticated clients may call the RPCs
revoke all on function public.buy_stock(text, numeric, numeric) from public;
revoke all on function public.sell_stock(text, numeric, numeric) from public;
grant execute on function public.buy_stock(text, numeric, numeric) to authenticated;
grant execute on function public.sell_stock(text, numeric, numeric) to authenticated;
