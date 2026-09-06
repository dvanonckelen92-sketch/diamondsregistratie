-- Uurregistratie-platform dansschool: initieel schema, view en RLS-policies

create extension if not exists "pgcrypto";

-- ============================================================
-- Tabellen
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  naam text not null,
  email text not null,
  rol text not null check (rol in ('juf', 'admin')),
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  created_at timestamptz not null default now()
);

create table rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  uurloon numeric(8,2) not null check (uurloon >= 0),
  geldig_vanaf date not null,
  created_at timestamptz not null default now()
);

create index rates_profile_category_datum_idx
  on rates (profile_id, category_id, geldig_vanaf desc);

create table hour_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id),
  datum date not null,
  aantal_uren numeric(5,2) not null check (aantal_uren > 0),
  opmerking text,
  status text not null default 'concept'
    check (status in ('concept', 'ingediend', 'goedgekeurd', 'betaald')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hour_entries_profile_datum_idx on hour_entries (profile_id, datum);
create index hour_entries_status_idx on hour_entries (status);

create table extra_payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  bedrag numeric(8,2) not null,
  omschrijving text not null,
  datum date not null,
  status text not null default 'goedgekeurd'
    check (status in ('goedgekeurd', 'betaald')),
  created_at timestamptz not null default now()
);

create index extra_payments_profile_datum_idx on extra_payments (profile_id, datum);

-- ============================================================
-- updated_at trigger voor hour_entries
-- ============================================================

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger hour_entries_set_updated_at
  before update on hour_entries
  for each row execute function set_updated_at();

-- ============================================================
-- Profiel automatisch aanmaken bij nieuwe auth-gebruiker
-- Rol/naam worden meegegeven via raw_user_meta_data bij signup;
-- default rol is 'juf' zodat een nieuw account nooit per ongeluk admin is.
-- ============================================================

create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, naam, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'naam', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'juf')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- View: uurregistraties met opgezocht tarief en berekend bedrag
-- ============================================================

-- security_invoker: RLS-policies van hour_entries/rates worden gecontroleerd
-- op basis van de aanroepende gebruiker, niet van de view-eigenaar.
create view hour_entries_with_amount
  with (security_invoker = true)
as
select
  he.*,
  r.uurloon,
  he.aantal_uren * r.uurloon as bedrag
from hour_entries he
join lateral (
  select uurloon
  from rates
  where rates.profile_id = he.profile_id
    and rates.category_id = he.category_id
    and rates.geldig_vanaf <= he.datum
  order by geldig_vanaf desc
  limit 1
) r on true;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table categories enable row level security;
alter table rates enable row level security;
alter table hour_entries enable row level security;
alter table extra_payments enable row level security;

create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and rol = 'admin'
  );
$$ language sql stable security definer set search_path = public;

-- profiles
create policy "eigen profiel of admin" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "admin beheert profielen" on profiles
  for update using (is_admin());

-- categories: iedereen ingelogd mag lezen, enkel admin schrijft
create policy "ingelogde gebruikers lezen categorieen" on categories
  for select using (auth.uid() is not null);

create policy "admin beheert categorieen" on categories
  for insert with check (is_admin());

create policy "admin wijzigt categorieen" on categories
  for update using (is_admin());

create policy "admin verwijdert categorieen" on categories
  for delete using (is_admin());

-- hour_entries
create policy "juf ziet eigen uren" on hour_entries
  for select using (profile_id = auth.uid() or is_admin());

create policy "juf voegt eigen uren toe" on hour_entries
  for insert with check (profile_id = auth.uid());

create policy "juf bewerkt eigen concept-uren" on hour_entries
  for update using (
    (profile_id = auth.uid() and status = 'concept') or is_admin()
  );

create policy "juf verwijdert eigen concept-uren" on hour_entries
  for delete using (
    (profile_id = auth.uid() and status = 'concept') or is_admin()
  );

-- rates
create policy "admin beheert tarieven" on rates
  for all using (is_admin()) with check (is_admin());

create policy "juf leest eigen tarieven" on rates
  for select using (profile_id = auth.uid() or is_admin());

-- extra_payments
create policy "admin beheert extra vergoedingen" on extra_payments
  for all using (is_admin()) with check (is_admin());

create policy "juf leest eigen extra vergoedingen" on extra_payments
  for select using (profile_id = auth.uid() or is_admin());
