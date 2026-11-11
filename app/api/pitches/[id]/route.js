import { NextResponse } from "next/server";
import { db, checkPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST { password, action: "watch" | "unwatch" | "remove" }
// "watch" po ogledu pobriše tudi vse glasove, da se začne nov krog.
export async function POST(req, { params }) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Napačna zahteva." }, { status: 400 }); }
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Napačno geslo." }, { status: 401 });
  }
  const id = params.id;
  try {
    const sb = db();
    let res;
    if (body.action === "watch") {
      res = await sb.from("pitches").update({ watched: true }).eq("id", id);
      if (res.error) throw res.error;
      res = await sb.from("votes").delete().gt("points", 0);
    } else if (body.action === "unwatch") {
      res = await sb.from("pitches").update({ watched: false }).eq("id", id);
    } else if (body.action === "remove") {
      res = await sb.from("pitches").delete().eq("id", id);
    } else {
      return NextResponse.json({ error: "Neznano dejanje." }, { status: 400 });
    }
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "To ni uspelo." }, { status: 500 });
  }
}
