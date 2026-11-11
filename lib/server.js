import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function digest(s) {
  return crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest();
}

export function checkPassword(pw) {
  const expected = process.env.HOUSE_PASSWORD;
  if (!expected || typeof pw !== "string") return false;
  return crypto.timingSafeEqual(digest(pw), digest(expected));
}

export const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
