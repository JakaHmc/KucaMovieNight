# Filmski večer (Next.js + Supabase, za Vercel)

Sostanovalci anonimno predlagajo film (slika + nekaj stavkov, brez naslova). Predlogi so zapečateni, dokler ne začnemo predstavitve. Brez prijave: vsak s povezavo lahko predlaga. Predstavitev, glasovanje, ponastavitve in odstranjevanje zahtevajo hišno geslo.

## Nastavitev

### 1. Supabase
SQL Editor > New query > prilepi `supabase/schema.sql` > Run.
(Če si schema.sql že zagnal pred glasovanjem, zaženi samo `supabase/votes.sql`.)

### 2. Vercel
Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HOUSE_PASSWORD` (`popcorn-gremlin-9000`). Nato Redeploy.

## Kako deluje
1. Vsak odda predlog (slika + opis). Na tabli so vidljive samo zapečatene vstopnice.
2. "Začni predstavitev" (geslo): predlogi se razkrijejo enega za drugim v naključnem vrstnem redu (gumba Nazaj/Naprej, tudi puščici na tipkovnici).
3. Po zadnjem predlogu se odpre glasovanje. Dodaš glasovalca po imenu; ta izbere tri različne filme za 3, 2 in 1 točko (če so v igri manj kot trije filmi, toliko, kolikor jih je).
4. Rezultati so sešteti sproti. "Ponastavi" pri imenu pobriše glasove ene osebe, "Ponastavi vse glasove" pobriše vse.
5. "Ogledali smo si ga" premakne zmagovalca med že predvajane in pobriše glasove za nov krog. Pri izenačenju izbereš sam.

Glasovanje poteka na eni napravi (ta, ki je vnesla geslo), npr. na televiziji ali prenosniku, vsak glasovalec pride na vrsto.

## Opombe
- Brskalnik nikoli ne govori s Supabase neposredno. Vse gre prek `app/api/*`, ki uporablja service role ključ iz okoljskih spremenljivk. Row level security je vklopljen brez pravil.
- Če odstraniš predlog, se izbrišejo tudi glasovi zanj.
- Slike se v brskalniku pomanjšajo na pod približno 190 KB in se shranijo kot besedilo.
