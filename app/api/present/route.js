import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db, checkPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST { password }: razkrije vse predloge, ki so še v igri, v naključnem vrstnem redu.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Napačna zahteva." }, { status: 400 }); }
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Napačno geslo." }, { status: 401 });
  }
  try {
    const sb = db();
    const { data: rows, error } = await sb
      .from("pitches")
      .select("id,watched")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const numbered = rows.map((r, i) => ({ id: r.id, n: i + 1, watched: r.watched }));
    const active = numbered.filter((r) => !r.watched);
    if (!active.length) return NextResponse.json({ error: "Ni predlogov za predstavitev." }, { status: 409 });

    const { data: full, error: e2 } = await sb
      .from("pitches")
      .select("id,description,image")
      .in("id", active.map((a) => a.id));
    if (e2) throw e2;
    const byId = Object.fromEntries(full.map((f) => [f.id, f]));
    const list = active
      .filter((a) => byId[a.id])
      .map((a) => ({ id: a.id, n: a.n, description: byId[a.id].description, image: byId[a.id].image }));

    for (let i = list.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return NextResponse.json({ pitches: list });
  } catch (e) {
    return NextResponse.json({ error: "Predstavitve ni bilo mogoče začeti." }, { status: 500 });
  }
}
