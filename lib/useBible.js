"use client";
import { useCallback, useEffect, useState } from "react";
import { buildIndexAsync } from "./searchIndex";

// Caches partagés : une version déjà chargée s'affiche instantanément
const dataCache = new Map();    // version → [livre][chapitre][verset]
const dataLoading = new Map();
const indexCache = new Map();   // version → index de recherche
const indexLoading = new Map();
let prefetched = false;

function loadData(version) {
  if (dataCache.has(version)) return Promise.resolve(dataCache.get(version));
  if (!dataLoading.has(version)) {
    dataLoading.set(
      version,
      fetch(`/bible/${version}.json`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((d) => { dataCache.set(version, d); return d; })
        .finally(() => dataLoading.delete(version))
    );
  }
  return dataLoading.get(version);
}

function loadIndex(version, data) {
  if (indexCache.has(version)) return Promise.resolve(indexCache.get(version));
  if (!indexLoading.has(version)) {
    indexLoading.set(
      version,
      buildIndexAsync(data)
        .then((i) => { indexCache.set(version, i); return i; })
        .finally(() => indexLoading.delete(version))
    );
  }
  return indexLoading.get(version);
}

// Versions « en ligne » (API YouVersion via /api/bible) : on connaît d'abord la forme de la Bible
// (nombre de versets par chapitre), puis chaque chapitre est téléchargé à la demande.
const onlineCache = new Map(); // version → { bible, loaded:Set, inflight:Map }

async function apiJson(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

async function loadSkeleton(version) {
  if (onlineCache.has(version)) return onlineCache.get(version);
  const counts = await apiJson(`/api/bible?action=index&v=${encodeURIComponent(version)}`);
  const entry = { bible: counts.map((bk) => bk.map((n) => Array(n).fill(null))), loaded: new Set(), inflight: new Map() };
  onlineCache.set(version, entry);
  return entry;
}

const idle = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1000));

// Télécharge les autres versions en arrière-plan, une par une
function prefetchOthers(current) {
  if (prefetched) return;
  prefetched = true;
  idle(() => {
    fetch("/bible/versions.json").then((r) => r.json()).then(async (list) => {
      for (const v of list) if (v.id !== current) { try { await loadData(v.id); } catch {} }
    }).catch(() => {});
  });
}

// public/bible/<version>.json → [livre][chapitre][verset] = texte
// online = version servie par l'API YouVersion : les chapitres arrivent à la demande (ensureChapter)
export function useBible(version = "lsg", online = false) {
  const [state, setState] = useState({ version: null, bible: null, index: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (online) {
      setLoading(!onlineCache.has(version));
      loadSkeleton(version).then((entry) => {
        if (cancelled) return;
        setState({ version, bible: entry.bible, index: null });
        setLoading(false);
      }).catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
      return () => { cancelled = true; };
    }
    setLoading(!dataCache.has(version));
    loadData(version).then((data) => {
      if (cancelled) return;
      // la Bible s'affiche tout de suite ; l'ancienne reste visible pendant le chargement
      setState({ version, bible: data, index: indexCache.get(version) || null });
      setLoading(false);
      // l'index de recherche se construit par petits morceaux, sans figer la page
      loadIndex(version, data).then((index) => {
        if (!cancelled) setState((s) => (s.version === version ? { ...s, index } : s));
      }).catch(() => {});
      prefetchOthers(version);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version, online]);

  const loadedVersion = state.version;

  // télécharge un chapitre d'une version en ligne (sans effet pour les versions locales)
  const ensureChapter = useCallback((b, c) => {
    const entry = onlineCache.get(loadedVersion);
    if (!entry) return Promise.resolve(true);
    const key = `${b}.${c}`;
    if (entry.loaded.has(key)) return Promise.resolve(true);
    if (!entry.inflight.has(key)) {
      entry.inflight.set(key, apiJson(`/api/bible?action=chapter&v=${encodeURIComponent(loadedVersion)}&b=${b}&c=${c}`)
        .then((verses) => {
          const next = entry.bible.slice();
          next[b] = next[b].slice();
          next[b][c] = verses;
          entry.bible = next;
          entry.loaded.add(key);
          setError(null);
          setState((s) => (s.version === loadedVersion ? { ...s, bible: next } : s));
          return true;
        })
        .catch((e) => { setError(e.message); return false; })
        .finally(() => entry.inflight.delete(key)));
    }
    return entry.inflight.get(key);
  }, [loadedVersion]);

  const chapterReady = useCallback((b, c) => {
    const entry = onlineCache.get(loadedVersion);
    return !entry || entry.loaded.has(`${b}.${c}`);
  }, [loadedVersion, state.bible]);

  return { bible: state.bible, index: state.index, loaded: state.version, loading, error, ensureChapter, chapterReady };
}
