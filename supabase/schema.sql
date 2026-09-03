-- Mum's Love Laundry — Version 1.0 Base MVP Schema
-- Run against a Supabase Postgres project (SQL Editor or `supabase db push`).

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  phone_number text,
  location_zone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- services
-- ============================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  base_price numeric(10, 2) not null,
  description text
);

alter table public.services enable row level security;

-- Services are public catalog data — readable by anyone (including anon).
create policy "Services are viewable by everyone"
  on public.services for select
  using (true);

insert into public.services (service_name, base_price, description) values
  ('Washing Only', 15.00, 'Standard wash cycle with detergent and fabric softener.'),
  ('Ironing Only', 10.00, 'Pressing and folding for clean or customer-supplied garments.'),
  ('Wash & Iron', 22.00, 'Full-service wash, dry, iron, and fold.')
on conflict do nothing;

-- ============================================================
-- orders
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id),
  status text not null default 'pending'
    check (status in ('pending', 'washing', 'ironing', 'out_for_delivery', 'completed')),
  pickup_date date not null,
  location_zone text not null,
  total_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Orders are viewable by owner"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Orders are insertable by owner"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Staff/admin status updates go through the service-role key in the
-- backend (server.js), which bypasses RLS — no customer-facing update
-- policy is defined here by design.

-- Enable Realtime on orders so CustomerDashboard.jsx can subscribe to
-- status changes without polling.
alter publication supabase_realtime add table public.orders;

-- ============================================================
-- Eastern Region (Ghana) supported zones — used by the backend
-- to validate BookingForm.jsx submissions.
-- ============================================================
create table if not exists public.location_zones (
  zone_name text primary key
);

alter table public.location_zones enable row level security;

create policy "Zones are viewable by everyone"
  on public.location_zones for select
  using (true);

insert into public.location_zones (zone_name) values
  ('Koforidua'), ('Akropong'), ('Nkawkaw'), ('Mpraeso'),
  ('Suhum'), ('Akim Oda'), ('Nsawam'), ('New Tafo')
on conflict do nothing;
