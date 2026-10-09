"use client";
import { useEffect, useRef, useState } from "react";
import { ROLES } from "@/lib/roles";

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
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
};

// En-tête : bouton Écran + pastille utilisateur avec menu
export default function UserMenu({ church, copied, onCopy, onLogout }) {
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
      <a href={`/display?k=${church.token}`} target="_blank" aria-label="Ouvrir l'écran de projection"
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-2.5 sm:px-3.5 py-1.5 transition duration-100 active:scale-95">
        <span className="hidden sm:inline">Écran</span>
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
              <span className="inline-block mt-1.5 rounded-full bg-neutral-700 px-2 py-0.5 text-[11px] text-amber-300">{ROLES[church.role]?.label}</span>
            </div>
            {church.role === "admin" && (
              <a role="menuitem" href="/admin" className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
                <Icon d={I.admin} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
                <span>Administration<span className="block text-xs text-neutral-400">Équipe, rôles et invitations</span></span>
              </a>
            )}
            <button role="menuitem" onClick={onCopy} className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-700">
              <Icon d={copied ? I.check : I.copy} className="h-[18px] w-[18px] mt-0.5 text-neutral-400" />
              <span>
                {copied ? "Lien copié" : "Copier le lien écran"}
                <span className="block text-xs text-neutral-400">Pour le PC du vidéoprojecteur</span>
              </span>
            </button>
            <button role="menuitem" onClick={onLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700">
              <Icon d={I.logout} className="h-[18px] w-[18px] text-neutral-400" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
