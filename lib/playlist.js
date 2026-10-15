"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Playlist du culte : l'ordre du service (versets, chants, notes, textes rapides).
// Gardée dans ce navigateur (séparée par église) et partagée en direct avec les autres opérateurs connectés.
// item = { id, k: "verse" | "chants" | "notes" | "text", title, r?, itemId?, text? }
const KEY = "hc.playlist.v1:";

export function usePlaylist(churchId) {
  const [items, setItems] = useState([]);
  const ref = useRef([]);
  ref.current = items;

  useEffect(() => {
    if (!churchId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY + churchId));
      if (Array.isArray(saved)) setItems(saved);
    } catch {}
  }, [churchId]);

  // remplace toute la liste (et la sauvegarde)
  const set = useCallback((next) => {
    setItems(next);
    ref.current = next;
    try { localStorage.setItem(KEY + churchId, JSON.stringify(next)); } catch {}
  }, [churchId]);

  const add = useCallback((it) => set([...ref.current, it]), [set]);
  const remove = useCallback((id) => set(ref.current.filter((x) => x.id !== id)), [set]);
  const move = useCallback((id, d) => {
    const a = [...ref.current];
    const i = a.findIndex((x) => x.id === id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set(a);
  }, [set]);

  return { items, set, add, remove, move };
}
