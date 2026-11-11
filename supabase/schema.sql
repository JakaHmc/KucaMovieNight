-- Run once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists pitches (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 20 and 420),
  image text not null check (char_length(image) < 200000),
  watched boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row level security on with no policies: the public anon key can read nothing.
-- All access goes through the Next.js API routes using the service role key,
-- which is how pitches stay sealed until someone rolls the projector.
alter table pitches enable row level security;
