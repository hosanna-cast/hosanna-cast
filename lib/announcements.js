"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { useChurch } from "./church";
import { uuid } from "./uuid";
import { isExpired } from "./expiry";

const BUCKET = "announcements";
export const MAX_VIDEO = 50 * 1024 * 1024;     // limite du forfait gratuit Supabase (voir supabase/temporaire.sql)
const MAX_SIDE = 1920;                          // une photo de téléphone est réduite à la taille d'un écran HD
const OK_IMG = /^image\/(jpeg|png|webp|gif)$/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// Photo : réduite (JPEG) si elle est trop grande ou trop lourde, sinon envoyée telle quelle.
async function prepareImage(file) {
  if (file.type === "image/gif" && file.size <= 10 * 1024 * 1024) return { blob: file, ext: "gif", type: file.type };   // GIF animé : on ne touche pas
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.max(bmp.width, bmp.height);
    if (side <= MAX_SIDE && file.size <= 2 * 1024 * 1024 && OK_IMG.test(file.type)) {
      bmp.close?.();
      return { blob: file, ext: EXT[file.type], type: file.type };
    }
    const k = Math.min(1, MAX_SIDE / side);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
    if (!blob) throw new Error("toBlob");
    return { blob, ext: "jpg", type: "image/jpeg" };
  } catch {
    if (OK_IMG.test(file.type) && file.size <= 10 * 1024 * 1024) return { blob: file, ext: EXT[file.type], type: file.type };
    throw new Error("image illisible (format HEIC ?). Envoie plutôt un JPG ou un PNG.");
  }
}

// Annonces : photos et vidéos { id, kind: "image" | "video", name, path, url, created_at, expires_at }
// Fichiers dans Supabase Storage, supprimés automatiquement 3 jours après l'envoi.
export function useAnnouncements() {
  const church = useChurch();
  const [list, setList] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const urlOf = (path) => createClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  useEffect(() => {
    if (!church) return;
    const db = createClient();
    let off = false;
    const load = async () => {
      const { data, error } = await db.from("announcements").select("id, kind, name, path, created_at, expires_at")
        .eq("church_id", church.id).order("created_at", { ascending: false });
      if (off) return;
      if (error) { setError(error.message); setReady(true); return; }
      setError("");
      const dead = data.filter((r) => isExpired(r.expires_at));
      if (dead.length) {                                   // nettoyage : fichiers puis lignes
        db.storage.from(BUCKET).remove(dead.map((r) => r.path))
          .then(() => db.from("announcements").delete().in("id", dead.map((r) => r.id)));
      }
      setList(data.filter((r) => !isExpired(r.expires_at)).map((r) => ({ ...r, url: urlOf(r.path) })));
      setReady(true);
    };
    load();
    const timer = setInterval(load, 30 * 60 * 1000);
    const ch = db.channel("ann:" + church.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: `church_id=eq.${church.id}` }, load)
      .subscribe();
    return () => { off = true; clearInterval(timer); db.removeChannel(ch); };
  }, [church?.id]);

  // files : FileList / tableau. Retourne la liste des erreurs (vide si tout va bien).
  const upload = useCallback(async (files) => {
    const db = createClient();
    const errs = [];
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const isVideo = file.type.startsWith("video/");
        if (!isVideo && !file.type.startsWith("image/")) throw new Error("format non pris en charge");
        if (isVideo && file.size > MAX_VIDEO) throw new Error(`vidéo trop lourde (${Math.round(file.size / 1048576)} Mo, maximum 50 Mo). Compresse-la ou raccourcis-la.`);
        let blob = file, type = file.type, ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        if (!isVideo) ({ blob, type, ext } = await prepareImage(file));
        const id = uuid();
        const path = `${church.id}/${id}.${ext}`;
        const up = await db.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "3600" });
        if (up.error) throw up.error;
        const row = { id, church_id: church.id, kind: isVideo ? "video" : "image", name: file.name.replace(/\.[^.]+$/, "").slice(0, 80), path };
        const ins = await db.from("announcements").insert(row).select("created_at, expires_at").single();
        if (ins.error) { await db.storage.from(BUCKET).remove([path]); throw ins.error; }
        setList((cur) => [{ ...row, ...ins.data, url: urlOf(path) }, ...cur]);
      } catch (e) {
        errs.push(`${file.name} : ${e.message || e}`);
      }
    }
    setBusy(false);
    if (errs.length) setError("");
    return errs;
  }, [church?.id]);

  const remove = useCallback(async (id) => {
    const db = createClient();
    const item = list.find((x) => x.id === id);
    setList((cur) => cur.filter((x) => x.id !== id));
    if (item) await db.storage.from(BUCKET).remove([item.path]);
    await db.from("announcements").delete().eq("id", id);
  }, [list]);

  return { list, ready, error, busy, upload, remove };
}
