import { NextResponse } from "next/server";
import { db, checkPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST { password, action: "watch" | "unwatch" | "remove" }
export async function POST(req, { params }) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const id = params.id;
  try {
    const sb = db();
    let res;
    if (body.action === "watch") res = await sb.from("pitches").update({ watched: true }).eq("id", id);
    else if (body.action === "unwatch") res = await sb.from("pitches").update({ watched: false }).eq("id", id);
    else if (body.action === "remove") res = await sb.from("pitches").delete().eq("id", id);
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "That did not work." }, { status: 500 });
  }
}
