"use client";
import { LOCALES, LOCALE_IDS } from "@/lib/i18n";
import { useLocale, useSetLocale, useT } from "@/lib/i18n/client";

// Sélecteur de langue (Français | English) : login, administration, menu de la console
export default function LangSwitch({ className = "" }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();
  return (
    <div role="group" aria-label={t("lang.label")} className={`inline-grid grid-flow-col gap-0.5 rounded-lg bg-neutral-800 border border-neutral-700 p-0.5 ${className}`}>
      {LOCALE_IDS.map((id) => (
        <button key={id} type="button" aria-pressed={locale === id} onClick={() => locale !== id && setLocale(id)}
          className={`rounded-md px-3 py-1 text-xs transition duration-100 active:scale-95 ${locale === id ? "bg-amber-400 text-black font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>
          {LOCALES[id]}
        </button>
      ))}
    </div>
  );
}
