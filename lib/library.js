"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { useChurch } from "./church";
import { uuid } from "./uuid";

const KEY = "bp.library.v1";          // ancien stockage navigateur (importé une fois)
const EMPTY = { notes: [], chants: [] };

const toItem = (row) => ({ ...row.data, id: row.id });

// Texte → diapositives : une diapositive par bloc séparé d'une ligne vide ou d'une ligne « --- ».
// Un bloc de plus de maxLines lignes est coupé en parts égales, toujours entre deux lignes (jamais au milieu d'une).
export const MAX_LINES = 6;
export function splitSlides(text, maxLines = MAX_LINES) {
  const blocks = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*-{3,}\s*$/gm, "\n\n")
    .split(/\n[ \t]*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return blocks.flatMap((b) => {
    const lines = b.split("\n");
    if (lines.length <= maxLines) return [b];
    const parts = Math.ceil(lines.length / maxLines);
    const size = Math.ceil(lines.length / parts);
    const out = [];
    for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size).join("\n"));
    return out;
  });
}

// Diapositives d'un élément : liste enregistrée (chants découpés/modifiés à la main) ou découpage du texte
export const slidesOf = (item) => (Array.isArray(item?.slides) ? item.slides : splitSlides(item?.text));

// kind = "notes" | "chants" ; item = { id, title, person, session, text, createdAt }
// Stockée dans Supabase (table library_items), séparée par église.
export function useLibrary() {
  const church = useChurch();
  const [lib, setLib] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!church) return;
    const db = createClient();
    let off = false;
    const load = async () => {
      const { data, error } = await db.from("library_items").select("id, kind, data")
        .eq("church_id", church.id).order("created_at", { ascending: false });
      if (off || error) return;
      const next = { notes: [], chants: [] };
      data.forEach((r) => next[r.kind]?.push(toItem(r)));
      // import unique de l'ancienne bibliothèque du navigateur
      if (!data.length && !localStorage.getItem(KEY + ".imported:" + church.id)) {
        try {
          const old = JSON.parse(localStorage.getItem(KEY));
          const rows = ["notes", "chants"].flatMap((kind) => (old?.[kind] || []).map((it) => {
            const { id, ...rest } = it;
            return { id: /^[0-9a-f-]{36}$/i.test(id) ? id : uuid(), church_id: church.id, kind, data: rest };
          }));
          if (rows.length) {
            const { error: e2 } = await db.from("library_items").insert(rows);
            if (!e2) { rows.forEach((r) => next[r.kind].push({ ...r.data, id: r.id })); }
          }
          localStorage.setItem(KEY + ".imported:" + church.id, "1");
        } catch {}
      }
      setLib(next); setReady(true);
    };
    load();
    // un autre appareil de la même église modifie la bibliothèque
    const ch = db.channel("lib:" + church.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "library_items", filter: `church_id=eq.${church.id}` }, load)
      .subscribe();
    return () => { off = true; db.removeChannel(ch); };
  }, [church?.id]);

  const add = useCallback((kind, item) => {
    const id = uuid();
    const it = { id, createdAt: Date.now(), ...item };
    setLib((cur) => ({ ...cur, [kind]: [it, ...cur[kind]] }));
    const { id: _id, ...data } = it;
    createClient().from("library_items").insert({ id, church_id: church.id, kind, data }).then(({ error }) => {
      if (error) { console.error(error); setLib((cur) => ({ ...cur, [kind]: cur[kind].filter((x) => x.id !== id) })); }
    });
    return id;
  }, [church?.id]);

  const remove = useCallback((kind, id) => {
    setLib((cur) => ({ ...cur, [kind]: cur[kind].filter((x) => x.id !== id) }));
    createClient().from("library_items").delete().eq("id", id).then(({ error }) => error && console.error(error));
  }, []);

  const update = useCallback((kind, id, patch) => {
    let merged;
    setLib((cur) => ({ ...cur, [kind]: cur[kind].map((x) => (x.id === id ? (merged = { ...x, ...patch }) : x)) }));
    setTimeout(() => {
      if (!merged) return;
      const { id: _id, ...data } = merged;
      createClient().from("library_items").update({ data }).eq("id", id).then(({ error }) => error && console.error(error));
    }, 0);
  }, []);

  return { lib, ready, add, remove, update };
}
