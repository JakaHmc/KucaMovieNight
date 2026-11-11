-- Zaženi enkrat v Supabase: SQL Editor > New query > prilepi > Run.
create table if not exists pitches (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 20 and 420),
  image text not null check (char_length(image) < 200000),
  watched boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row level security je vklopljen brez pravil: javni ključ ne more prebrati nič.
-- Ves dostop poteka prek Next.js API poti s service role ključem,
-- zato predlogi ostanejo zapečateni, dokler jih nekdo ne razkrije.
alter table pitches enable row level security;

-- Glasovanje
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  voter_name text not null check (char_length(voter_name) between 1 and 30),
  pitch_id uuid not null references pitches(id) on delete cascade,
  points int not null check (points between 1 and 3),
  created_at timestamptz not null default now()
);
create unique index if not exists votes_voter_points on votes (lower(voter_name), points);
create unique index if not exists votes_voter_pitch on votes (lower(voter_name), pitch_id);
alter table votes enable row level security;
