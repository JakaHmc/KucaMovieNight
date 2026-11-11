-- Zaženi to enkrat v Supabase: SQL Editor > New query > prilepi > Run.
-- (Če si schema.sql že zagnal prej, zaženi samo to datoteko.)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  voter_name text not null check (char_length(voter_name) between 1 and 30),
  pitch_id uuid not null references pitches(id) on delete cascade,
  points int not null check (points between 1 and 3),
  created_at timestamptz not null default now()
);

-- Vsak glasovalec lahko vsako število točk (3, 2, 1) uporabi samo enkrat
-- in vsak film oceni samo enkrat.
create unique index if not exists votes_voter_points on votes (lower(voter_name), points);
create unique index if not exists votes_voter_pitch on votes (lower(voter_name), pitch_id);

alter table votes enable row level security;
