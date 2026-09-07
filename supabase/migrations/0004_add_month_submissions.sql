-- Opmerking bij het indienen van een maand: een juf kan bij "Uren indienen"
-- één opmerking per maand meegeven (bv. reden voor afwijkende uren), die de
-- beheerder kan lezen in het overzicht. Eén rij per juf + maand, niet per
-- uurregistratie, want het gaat om de indiening als geheel.

create table month_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  maand text not null check (maand ~ '^\d{4}-\d{2}$'),
  opmerking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, maand)
);

create index month_submissions_maand_idx on month_submissions (maand);

create trigger month_submissions_set_updated_at
  before update on month_submissions
  for each row execute function set_updated_at();

alter table month_submissions enable row level security;

create policy "juf leest eigen opmerking of admin" on month_submissions
  for select using (profile_id = auth.uid() or is_admin());

create policy "juf voegt eigen opmerking toe" on month_submissions
  for insert with check (profile_id = auth.uid());

create policy "juf wijzigt eigen opmerking of admin" on month_submissions
  for update using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());
