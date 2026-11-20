"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { useChurch } from "./church";
import { uuid } from "./uuid";

// Plan de culte : l'ordre du service, enregistré dans Supabase (table service_plans, voir supabase/plan-culte.sql)
// et partagé en direct entre tous les appareils de l'église. Il remplace l'ancienne playlist (jamais branchée).
//
// plan = { id, name, service_date, items, rev }
// item = { id, k: "verse" | "chants" | "notes" | "media" | "text", title, r?, itemId?, text? }
//   verse : r = { b, c, v, vEnd }  (indices, indépendants de la version de Bible)
//   chants / notes / media : itemId = identifiant dans la bibliothèque / les annonces
//   text : text = texte projeté tel quel
//
// Enregistrement : automatique (0,5 s après la dernière modification), avec contrôle de révision.
// Si quelqu'un d'autre a modifié le plan entre-temps, on recharge sa version (état « conflict »).
const ACTIVE_KEY = "hc.plan.active:";
const MAX_ITEMS = 200;
const SAVE_DELAY = 500;

const pad = (n) => String(n).padStart(2, "0");
export const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function nextSunday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return dateStr(d);
}
export const frDate = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
};

export function useServicePlans(enabled = true) {
  const church = useChurch();
  const [plans, setPlans] = useState([]);
  const [activeId, setActive] = useState(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("saved");       // saved | saving | error | conflict
  const [error, setError] = useState("");
  const plansRef = useRef([]);
  const activeRef = useRef(null);
  const dirty = useRef(new Set());                     // plans modifiés ici, pas encore enregistrés
  const inflight = useRef(new Set());                  // plans en cours d'enregistrement
  const timers = useRef(new Map());
  const loadRef = useRef(() => {});

  const commit = (next) => { plansRef.current = next; setPlans(next); };
  activeRef.current = activeId;

  // ---- lecture + mise à jour en direct -----------------------------------------------------------
  useEffect(() => {
    if (!church?.id || !enabled) return;
    const db = createClient();
    let off = false;
    const load = async () => {
      const { data, error: e } = await db.from("service_plans").select("id, name, service_date, items, rev")
        .eq("church_id", church.id)
        .order("service_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (off) return;
      if (e) { setError(e.message); setReady(true); return; }
      const cur = plansRef.current;
      commit(data.map((p) => {
        const mine = cur.find((x) => x.id === p.id);
        // on garde la version locale si elle est plus récente que celle du serveur ou pas encore enregistrée
        if (mine && (dirty.current.has(p.id) || inflight.current.has(p.id) || p.rev < mine.rev)) return { ...p, items: mine.items, rev: mine.rev };
        return { ...p, items: Array.isArray(p.items) ? p.items : [] };
      }));
      setReady(true);
    };
    loadRef.current = load;
    load();
    let debounce;
    const reload = () => { clearTimeout(debounce); debounce = setTimeout(load, 300); };
    const ch = db.channel("plans:" + church.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_plans", filter: `church_id=eq.${church.id}` }, reload)
      .subscribe();
    return () => { off = true; clearTimeout(debounce); db.removeChannel(ch); };
  }, [church?.id, enabled]);

  // plan actif : celui choisi sur cet appareil, sinon le prochain culte à venir, sinon le plus récent
  useEffect(() => {
    if (!ready || !church?.id) return;
    if (activeId && plans.some((p) => p.id === activeId)) return;
    let saved = null;
    try { saved = localStorage.getItem(ACTIVE_KEY + church.id); } catch {}
    const today = dateStr(new Date());
    const upcoming = plans.filter((p) => p.service_date && p.service_date >= today).sort((a, b) => a.service_date.localeCompare(b.service_date))[0];
    const pick = plans.find((p) => p.id === saved) || upcoming || plans[0] || null;
    setActive(pick ? pick.id : null);
  }, [ready, plans, activeId, church?.id]);

  const setActiveId = useCallback((id) => {
    setActive(id);
    try { localStorage.setItem(ACTIVE_KEY + church.id, id || ""); } catch {}
  }, [church?.id]);

  // ---- enregistrement ----------------------------------------------------------------------------
  const flush = useCallback(async (id) => {
    if (inflight.current.has(id)) { dirty.current.add(id); return; }     // un enregistrement est en cours : il sera suivi d'un autre
    const p = plansRef.current.find((x) => x.id === id);
    if (!p) return;
    dirty.current.delete(id);
    inflight.current.add(id);
    setStatus("saving");
    const { data, error: e } = await createClient().from("service_plans").update({ items: p.items }).eq("id", id).eq("rev", p.rev).select("rev");
    inflight.current.delete(id);
    if (e) {                                                              // réseau coupé, droits… : on garde la modification et on réessaie
      setStatus("error"); setError(e.message); dirty.current.add(id);
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => flush(id), 5000));
      return;
    }
    if (!data?.length) {                                                  // la révision a changé : quelqu'un d'autre a modifié ce plan
      dirty.current.delete(id); setStatus("conflict"); loadRef.current();
      return;
    }
    setError("");
    commit(plansRef.current.map((x) => (x.id === id ? { ...x, rev: data[0].rev } : x)));
    if (dirty.current.has(id)) flush(id); else setStatus("saved");
  }, []);

  const saveSoon = useCallback((id) => {
    dirty.current.add(id);
    setStatus("saving");
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), SAVE_DELAY));
  }, [flush]);

  // on quitte la page : tout ce qui attend est envoyé tout de suite
  useEffect(() => {
    const now = () => dirty.current.forEach((id) => { clearTimeout(timers.current.get(id)); flush(id); });
    const onVis = () => { if (document.visibilityState === "hidden") now(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", now);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", now); };
  }, [flush]);

  // ---- éléments du plan actif ---------------------------------------------------------------------
  const active = plans.find((p) => p.id === activeId) || null;
  const items = active?.items || [];

  const setItems = useCallback((next) => {
    const id = activeRef.current;
    if (!id) return;
    commit(plansRef.current.map((p) => (p.id === id ? { ...p, items: next.slice(0, MAX_ITEMS) } : p)));
    saveSoon(id);
  }, [saveSoon]);
  const cur = () => plansRef.current.find((p) => p.id === activeRef.current)?.items || [];

  const add = useCallback((it) => { if (activeRef.current) setItems([...cur(), { id: uuid(), ...it }]); return !!activeRef.current; }, [setItems]);
  const removeItem = useCallback((id) => setItems(cur().filter((x) => x.id !== id)), [setItems]);
  const move = useCallback((id, d) => {
    const a = [...cur()];
    const i = a.findIndex((x) => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  }, [setItems]);
  const clear = useCallback(() => setItems([]), [setItems]);

  // ---- gestion des plans --------------------------------------------------------------------------
  const create = useCallback(async (name, date, from = []) => {
    const id = uuid();
    const row = { id, church_id: church.id, name: name.trim() || "Culte", service_date: date || null, items: from };
    const { data, error: e } = await createClient().from("service_plans").insert(row).select("rev").single();
    if (e) { setError(e.message); setStatus("error"); return null; }
    commit([{ id, name: row.name, service_date: row.service_date, items: from, rev: data.rev }, ...plansRef.current]);
    setActiveId(id);
    return id;
  }, [church?.id, setActiveId]);

  const duplicate = useCallback((id) => {
    const p = plansRef.current.find((x) => x.id === id);
    if (!p) return null;
    return create(`${p.name} (copie)`, nextSunday(), p.items.map((x) => ({ ...x, id: uuid() })));
  }, [create]);

  const rename = useCallback(async (id, name, date) => {
    commit(plansRef.current.map((p) => (p.id === id ? { ...p, name, service_date: date || null } : p)));
    const { error: e } = await createClient().from("service_plans").update({ name, service_date: date || null }).eq("id", id);
    if (e) { setError(e.message); setStatus("error"); }
  }, []);

  const remove = useCallback(async (id) => {
    clearTimeout(timers.current.get(id)); dirty.current.delete(id);
    const rest = plansRef.current.filter((p) => p.id !== id);
    commit(rest);
    if (activeRef.current === id) setActiveId(rest[0]?.id || null);
    const { error: e } = await createClient().from("service_plans").delete().eq("id", id);
    if (e) { setError(e.message); setStatus("error"); }
  }, [setActiveId]);

  return { plans, active, activeId, setActiveId, items, ready, status, error, add, removeItem, move, clear, create, duplicate, rename, remove };
}
