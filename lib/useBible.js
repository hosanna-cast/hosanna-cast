"use client";
import { useEffect, useState } from "react";
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
export function useBible(version = "lsg") {
  const [state, setState] = useState({ version: null, bible: null, index: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
  }, [version]);

  return { bible: state.bible, index: state.index, loaded: state.version, loading };
}
