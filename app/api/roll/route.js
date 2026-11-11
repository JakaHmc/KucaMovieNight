import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db, checkPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST { password }: pick a random pitch still in the running and reveal it.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
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
    if (!active.length) return NextResponse.json({ error: "Nothing left to roll." }, { status: 409 });

    const pick = active[crypto.randomInt(active.length)];
    const { data: full, error: e2 } = await sb
      .from("pitches")
      .select("id,description,image")
      .eq("id", pick.id)
      .single();
    if (e2) throw e2;

    return NextResponse.json({
      ids: active.map((a) => a.id),
      winner: { id: full.id, n: pick.n, description: full.description, image: full.image },
    });
  } catch (e) {
    return NextResponse.json({ error: "Could not roll the projector." }, { status: 500 });
  }
}
