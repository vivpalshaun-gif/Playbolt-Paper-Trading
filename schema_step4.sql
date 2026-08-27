-- Step 4: Limit orders for paper trading
-- Run in Supabase SQL Editor AFTER schema_step1.sql and schema_step2.sql.

create table if not exists public.limit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  shares numeric not null check (shares > 0),
  limit_price numeric not null check (limit_price > 0),
  status text not null default 'open'
    check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  filled_price numeric
);

create index if not exists limit_orders_user_status_idx
  on public.limit_orders (user_id, status, created_at desc);

alter table public.limit_orders enable row level security;

drop policy if exists "Users can read own limit orders" on public.limit_orders;
create policy "Users can read own limit orders"
  on public.limit_orders
  for select
  using (auth.uid() = user_id);

-- Writes go through SECURITY DEFINER RPCs only
drop policy if exists "Users can insert own limit orders" on public.limit_orders;
drop policy if exists "Users can update own limit orders" on public.limit_orders;

-- Place a pending limit order (does not reserve cash until fill)
create or replace function public.place_limit_order(
  p_symbol text,
  p_side text,
  p_shares numeric,
  p_limit_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_symbol text := upper(trim(p_symbol));
  v_side text := lower(trim(p_side));
  v_id uuid;
  v_holding_shares numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_symbol is null or v_symbol = '' then
    raise exception 'Symbol is required';
  end if;

  if v_side not in ('buy', 'sell') then
    raise exception 'Side must be buy or sell';
  end if;

  if p_shares is null or p_shares <= 0 then
    raise exception 'Shares must be greater than 0';
  end if;

  if p_limit_price is null or p_limit_price <= 0 then
    raise exception 'Limit price must be greater than 0';
  end if;

  if v_side = 'sell' then
    select shares into v_holding_shares
    from public.holdings
    where user_id = v_uid and symbol = v_symbol;

    if v_holding_shares is null or v_holding_shares < p_shares then
      raise exception 'Not enough shares to place sell limit';
    end if;
  end if;

  insert into public.limit_orders (user_id, symbol, side, shares, limit_price)
  values (v_uid, v_symbol, v_side, p_shares, p_limit_price)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.cancel_limit_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.limit_orders%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_order
  from public.limit_orders
  where id = p_order_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'open' then
    raise exception 'Only open orders can be cancelled';
  end if;

  update public.limit_orders
  set status = 'cancelled'
  where id = p_order_id;
end;
$$;

-- Attempt to fill one open limit order at the given market price
create or replace function public.try_fill_limit_order(
  p_order_id uuid,
  p_market_price numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.limit_orders%rowtype;
  v_should_fill boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_market_price is null or p_market_price <= 0 then
    raise exception 'Market price must be greater than 0';
  end if;

  select * into v_order
  from public.limit_orders
  where id = p_order_id and user_id = v_uid
  for update;

  if not found then
    return false;
  end if;

  if v_order.status <> 'open' then
    return false;
  end if;

  if v_order.side = 'buy' and p_market_price <= v_order.limit_price then
    v_should_fill := true;
  elsif v_order.side = 'sell' and p_market_price >= v_order.limit_price then
    v_should_fill := true;
  end if;

  if not v_should_fill then
    return false;
  end if;

  if v_order.side = 'buy' then
    perform public.buy_stock(v_order.symbol, v_order.shares, p_market_price);
  else
    perform public.sell_stock(v_order.symbol, v_order.shares, p_market_price);
  end if;

  update public.limit_orders
  set
    status = 'filled',
    filled_at = now(),
    filled_price = p_market_price
  where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.place_limit_order(text, text, numeric, numeric) from public;
revoke all on function public.cancel_limit_order(uuid) from public;
revoke all on function public.try_fill_limit_order(uuid, numeric) from public;

grant execute on function public.place_limit_order(text, text, numeric, numeric) to authenticated;
grant execute on function public.cancel_limit_order(uuid) to authenticated;
grant execute on function public.try_fill_limit_order(uuid, numeric) to authenticated;
