# Movie Night (Next.js + Supabase, for Vercel)

Roommates pitch a movie anonymously (an image plus a few sentences, no title). Pitches stay sealed on the board until someone rolls the projector. No logins: anyone with the link can pitch. Rolling, marking things watched and removing pitches need the house password.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the Project URL and the `service_role` key.

### 2. Vercel
1. Put this folder in a GitHub repo and import it in Vercel (framework: Next.js, nothing to change).
2. Add three environment variables (Settings > Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HOUSE_PASSWORD` (the funny one: `popcorn-gremlin-9000`)
3. Deploy. Share the URL with the house.

### Local
```
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## How it works
- The browser never talks to Supabase. Everything goes through `app/api/*` routes that use the service role key, which lives only in server environment variables. Row level security is on with no policies, so the public key can read nothing.
- `GET /api/pitches` returns pitches still in the running as ids and numbers only. The text and image are sent only for already-screened pitches.
- `POST /api/roll` checks the password, picks a random unscreened pitch and returns it. Only the person who rolled sees the text, so the others stay surprised until it is marked watched.
- Images are shrunk in the browser to under about 190 KB and stored as a text column, so no Supabase Storage setup is needed.

## Limits
- No logins means no "who pitched it" and no per-author delete. Removing uses the house password.
- Anyone with the link can add pitches. Keep the URL within the house.
- The board refreshes every 15 seconds and after your own actions.
