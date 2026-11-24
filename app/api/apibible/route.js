import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Diagnostic API.Bible (https://scripture.api.bible). La clé (API_BIBLE_KEY) reste sur le serveur.
//   GET /api/apibible?lang=fra   → Bibles de cette langue que la clé peut lire (fra, eng…)
const KEY = process.env.API_BIBLE_KEY;
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);
  if (!KEY) return fail("API_BIBLE_KEY absente sur ce déploiement.", 500);

  const lang = (new URL(req.url).searchParams.get("lang") || "fra").replace(/[^a-z]/gi, "").slice(0, 3);
  const res = await fetch(`https://api.scripture.api.bible/v1/bibles?language=${lang}&include-full-details=false`, {
    headers: { "api-key": KEY, Accept: "application/json" }, cache: "no-store",
  });
  if (!res.ok) return fail(`API.Bible ${res.status}`, 502);
  const j = await res.json();
  return NextResponse.json((j.data || []).map((b) => ({ id: b.id, abbreviation: b.abbreviationLocal || b.abbreviation, name: b.name })));
}
