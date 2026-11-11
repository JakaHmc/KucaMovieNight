import { NextResponse } from "next/server";
import { db, checkPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// POST { password, action: "list" | "submit" | "resetVoter" | "resetAll", ... }
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return bad("Napačna zahteva."); }
  if (!checkPassword(body.password)) return bad("Napačno geslo.", 401);

  try {
    const sb = db();

    if (body.action === "list") {
      const { data, error } = await sb
        .from("votes")
        .select("voter_name,pitch_id,points")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return NextResponse.json({ votes: data });
    }

    if (body.action === "resetAll") {
      const { error } = await sb.from("votes").delete().gt("points", 0);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const voter = typeof body.voter === "string" ? body.voter.trim().replace(/\s+/g, " ") : "";
    if (voter.length < 1 || voter.length > 30) return bad("Ime mora imeti od 1 do 30 znakov.");

    // Najdi obstoječe glasove te osebe (ne glede na velike/male črke).
    const { data: existing, error: eEx } = await sb.from("votes").select("voter_name");
    if (eEx) throw eEx;
    const matched = [...new Set(existing.map((v) => v.voter_name))]
      .filter((n) => n.toLowerCase() === voter.toLowerCase());

    if (body.action === "resetVoter") {
      if (matched.length) {
        const { error } = await sb.from("votes").delete().in("voter_name", matched);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "submit") {
      const picks = Array.isArray(body.picks) ? body.picks : [];
      const { data: act, error: eAct } = await sb.from("pitches").select("id").eq("watched", false);
      if (eAct) throw eAct;
      const activeIds = new Set(act.map((a) => a.id));
      const required = Math.min(3, activeIds.size);

      const points = picks.map((p) => p && p.points);
      const ids = picks.map((p) => p && p.pitchId);
      const okPoints = points.every((x) => Number.isInteger(x) && x >= 1 && x <= 3) && new Set(points).size === points.length;
      const okIds = ids.every((x) => typeof x === "string" && activeIds.has(x)) && new Set(ids).size === ids.length;
      if (picks.length !== required || !okPoints || !okIds) {
        return bad(`Izberi ${required} različne filme za različne točke.`);
      }

      if (matched.length) {
        const { error } = await sb.from("votes").delete().in("voter_name", matched);
        if (error) throw error;
      }
      const name = matched[0] || voter;
      const rows = picks.map((p) => ({ voter_name: name, pitch_id: p.pitchId, points: p.points }));
      const { error: eIns } = await sb.from("votes").insert(rows);
      if (eIns) throw eIns;
      return NextResponse.json({ ok: true });
    }

    return bad("Neznano dejanje.");
  } catch (e) {
    return bad("To ni uspelo.", 500);
  }
}
