-- Zaženi enkrat v Supabase: SQL Editor > New query > prilepi > Run.
-- Doda stolpec za naslov filma (skrit do razkritja zmagovalca).
alter table pitches add column if not exists title text check (title is null or char_length(title) between 1 and 80);
