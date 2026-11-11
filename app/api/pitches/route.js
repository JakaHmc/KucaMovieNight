import { NextResponse } from "next/server";
import { db, IMG_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET: tabla. Predlogi v igri so zapečateni (samo id in številka).
// Naslov, besedilo in slika so poslani samo za že predvajane predloge.
export async function GET() {
  try {
    const sb = db();
    const { data: rows, error } = await sb
      .from("pitches")
      .select("id,watched")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    const numbered = rows.map((r, i) => ({ id: r.id, n: i + 1, watched: r.watched }));
    const active = numbered.filter((r) => !r.watched).map(({ id, n }) => ({ id, n }));
    const watched = numbered.filter((r) => r.watched);

    let screened = [];
    if (watched.length) {
      const { data, error: e2 } = await sb
        .from("pitches")
        .select("id,title,description,image")
        .in("id", watched.map((w) => w.id));
      if (e2) throw e2;
      const byId = Object.fromEntries(data.map((d) => [d.id, d]));
      screened = watched
        .filter((w) => byId[w.id])
        .map((w) => ({ id: w.id, n: w.n, title: byId[w.id].title || null, description: byId[w.id].description, image: byId[w.id].image }));
    }
    return NextResponse.json({ active, screened });
  } catch (e) {
    return NextResponse.json({ error: "Table ni bilo mogoče naložiti." }, { status: 500 });
  }
}

// POST: dodaj predlog. Brez prijave, vsak s povezavo lahko predlaga.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Napačna zahteva." }, { status: 400 }); }
  const description = typeof body.description === "string" ? body.description.replace(/\n{3,}/g, "\n\n").trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  const image = body.image;
  if (title.length < 1 || title.length > 80) {
    return NextResponse.json({ error: "Vpiši naslov filma (do 80 znakov)." }, { status: 400 });
  }
  if (description.length < 20 || description.length > 420) {
    return NextResponse.json({ error: "Napiši od 20 do 420 znakov." }, { status: 400 });
  }
  if (typeof image !== "string" || image.length >= 200000 || !IMG_RE.test(image)) {
    return NextResponse.json({ error: "Te slike ni mogoče uporabiti." }, { status: 400 });
  }
  try {
    const { error } = await db().from("pitches").insert({ title, description, image });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Predloga ni bilo mogoče shraniti." }, { status: 500 });
  }
}
