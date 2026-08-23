-- Step 1: Profiles table, new-user auto-provisioning trigger, and RLS
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
--
-- New users start with cash_balance = 100000.00 (see default + trigger below).
-- Re-running this script does NOT reset existing users' cash balances.

-- 1. Profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  cash_balance numeric not null default 100000.00,
  created_at timestamptz not null default now()
);

-- 2. Trigger function: provision a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, cash_balance)
  values (new.id, 100000.00);
  return new;
end;
$$;

-- 3. Fire handle_new_user() after every new row in auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4. Row Level Security: users can only read/update their own profile
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
