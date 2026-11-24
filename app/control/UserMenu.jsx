"use client";
import { useEffect, useRef, useState } from "react";
import { roleLabel } from "@/lib/roles";
import { useT } from "@/lib/i18n/client";
import LangSwitch from "../LangSwitch";
import { canPlaceWindows, openOnSecondScreen } from "@/lib/secondScreen";

const Icon = ({ d, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  out: ["M14 3h7v7", "M10 14 21 3", "M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"],
  chev: ["m6 9 6 6 6-6"],
  copy: ["M9 9h11v11H9z", "M5 15V5a1 1 0 0 1 1-1h10"],
  check: ["m5 12 5 5L20 7"],
  admin: ["M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z", "m9 12 2 2 4-4"],
  key: ["M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8z", "m15.5 7.5 3 3L22 7l-3-3"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
};

// En-tête : bouton Écran + pastille utilisateur avec menu
export default function UserMenu({ church, copied, onCopy, copiedObs, onCopyObs, onLogout, onRotate }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const fullName = [church.firstName, church.lastName].filter(Boolean).join(" ");
  const shortName = church.firstName || church.email.split("@")[0];
  const initial = shortName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <a href={`/display?k=${church.token}`} target="_blank" aria-label={t("menu.screenOpen")}
        title={canPlaceWindows() ? t("menu.screenSecond") : t("menu.screenOpen")}
        onClick={(e) => {
          // ordinateur avec 2ᵉ écran : la fenêtre s'ouvre directement dessus ; sinon le lien s'ouvre normalement dans un nouvel onglet
          if (!canPlaceWindows() || e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          const url = `${location.origin}/display?k=${church.token}`;
          openOnSecondScreen(url).then((w) => { if (!w) window.open(url, "_blank"); }).catch(() => window.open(url, "_blank"));
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-2.5 sm:px-3.5 py-1.5 transition duration-100 active:scale-95">
        <span className="hidden sm:inline">{t("menu.screen")}</span>
        <Icon d={I.out} className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </a>

      <div ref={box} className="relative">
        <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-800 border border-neutral-600 hover:border-neutral-500 pl-1 pr-2 sm:pr-3 py-1 text-sm transition duration-100 active:scale-95">
          <span className="h-7 w-7 rounded-full bg-amber-400 text-black font-medium flex items-center justify-center text-[13px]">{initial}</span>
          <span className="hidden sm:inline max-w-[9rem] truncate">{shortName}</span>
          <Icon d={I.chev} className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl bg-neutral-800 border border-neutral-600 p-1.5 z-50 shadow-xl">
            <div className="px-3 py-2.5 border-b border-neutral-700 mb-1">
              <div className="text-sm font-medium truncate">{fullName || shortName}</div>
              <div className="text-[13px] text-neutral-400 truncate">{church.name}</div>
              <div className="text-xs text-neutral-500 truncate">{church.email}</div>
              <span className="inline-block mt-1.5 rounded-full bg-neutral-700 px-2 py-0.5 text-[11px] text-amber-300">{roleLabel(t, church.role)}</span>
            </div>
            {church.role === "admin" && (
              <a role="menuitem" href="/admin" className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
                <Icon d={I.admin} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
                <span>{t("menu.admin")}<span className="block text-xs text-neutral-400">{t("menu.adminDesc")}</span></span>
              </a>
            )}
            <button role="menuitem" onClick={onCopy} className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
              <Icon d={copied ? I.check : I.copy} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
              <span>
                {copied ? t("menu.copied") : t("menu.copyScreen")}
                <span className="block text-xs text-neutral-400">{t("menu.copyScreenDesc")}</span>
              </span>
            </button>
            <button role="menuitem" onClick={onCopyObs} className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
              <Icon d={copiedObs ? I.check : I.copy} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
              <span>
                {copiedObs ? t("menu.copied") : t("menu.copyObs")}
                <span className="block text-xs text-neutral-400">{t("menu.copyObsDesc")}</span>
              </span>
            </button>
            {onRotate && (
              <button role="menuitem" onClick={() => { setOpen(false); onRotate(); }} className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
                <Icon d={I.key} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
                <span>{t("menu.rotate")}<span className="block text-xs text-neutral-400">{t("menu.rotateDesc")}</span></span>
              </button>
            )}
            {church.role !== "standard" && church.role !== "annonces" && (
              <a role="menuitem" href={`/speaker?k=${church.token}`} target="_blank" className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
                <Icon d={I.out} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
                <span>{t("menu.speaker")}<span className="block text-xs text-neutral-400">{t("menu.speakerDesc")}</span></span>
              </a>
            )}
            <a role="menuitem" href="/change-password" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700">
              <Icon d={I.key} className="h-[18px] w-[18px] text-neutral-400" />
              {t("menu.changePassword")}
            </a>
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-neutral-300">{t("menu.language")}</span>
              <LangSwitch />
            </div>
            <button role="menuitem" onClick={onLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700">
              <Icon d={I.logout} className="h-[18px] w-[18px] text-neutral-400" />
              {t("common.logout")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
