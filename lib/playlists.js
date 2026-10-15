"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { useChurch } from "./church";
import { uuid } from "./uuid";
import { isExpired } from "./expiry";

// Playlists de chants : { id, name, chant_ids: [id de chant…], created_at, expires_at }
// Stockées dans Supabase (table playlists), effacées automatiquement 3 jours après leur création.
export function usePlaylists() {
  const church = useChurch();
  const [list, setList] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!church) return;
    const db = createClient();
    let off = false;
    const load = async () => {
      const { data, error } = await db.from("playlists").select("id, name, chant_ids, created_at, expires_at")
        .eq("church_id", church.id).order("created_at", { ascending: false });
      if (off) return;
      if (error) { setError(error.message); setReady(true); return; }
      setError("");
      const dead = data.filter((p) => isExpired(p.expires_at));
      if (dead.length) db.from("playlists").delete().in("id", dead.map((p) => p.id)).then(() => {});   // nettoyage
      setList(data.filter((p) => !isExpired(p.expires_at)).map((p) => ({ ...p, chant_ids: Array.isArray(p.chant_ids) ? p.chant_ids : [] })));
      setReady(true);
    };
    load();
    const timer = setInterval(load, 30 * 60 * 1000);       // une playlist périmée disparaît même si la page reste ouverte
    const ch = db.channel("pl:" + church.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "playlists", filter: `church_id=eq.${church.id}` }, load)
      .subscribe();
    return () => { off = true; clearInterval(timer); db.removeChannel(ch); };
  }, [church?.id]);

  const create = useCallback(async (name) => {
    const id = uuid();
    const { data, error } = await createClient().from("playlists").insert({ id, church_id: church.id, name }).select("created_at, expires_at").single();
    if (error) { setError(error.message); return null; }
    setError("");
    setList((cur) => [{ id, name, chant_ids: [], ...data }, ...cur]);
    return id;
  }, [church?.id]);

  const remove = useCallback((id) => {
    setList((cur) => cur.filter((p) => p.id !== id));
    createClient().from("playlists").delete().eq("id", id).then(({ error }) => error && console.error(error));
  }, []);

  const setChants = useCallback((id, chant_ids) => {
    setList((cur) => cur.map((p) => (p.id === id ? { ...p, chant_ids } : p)));
    createClient().from("playlists").update({ chant_ids }).eq("id", id).then(({ error }) => error && console.error(error));
  }, []);

  return { list, ready, error, create, remove, setChants };
}
