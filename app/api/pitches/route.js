import { NextResponse } from "next/server";
import { db, IMG_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET: the board. Pitches still in the running come back sealed (id and number only).
// Only already-screened pitches include their text and image.
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
        .select("id,description,image")
        .in("id", watched.map((w) => w.id));
      if (e2) throw e2;
      const byId = Object.fromEntries(data.map((d) => [d.id, d]));
      screened = watched
        .filter((w) => byId[w.id])
        .map((w) => ({ id: w.id, n: w.n, description: byId[w.id].description, image: byId[w.id].image }));
    }
    return NextResponse.json({ active, screened });
  } catch (e) {
    return NextResponse.json({ error: "Could not load the board." }, { status: 500 });
  }
}

// POST: add a pitch. No login, anyone with the link can pitch.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const description = typeof body.description === "string" ? body.description.replace(/\n{3,}/g, "\n\n").trim() : "";
  const image = body.image;
  if (description.length < 20 || description.length > 420) {
    return NextResponse.json({ error: "Write 20 to 420 characters." }, { status: 400 });
  }
  if (typeof image !== "string" || image.length >= 200000 || !IMG_RE.test(image)) {
    return NextResponse.json({ error: "That image could not be used." }, { status: 400 });
  }
  try {
    const { error } = await db().from("pitches").insert({ description, image });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Could not save your pitch." }, { status: 500 });
  }
}
