import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

export const metadata = { title: "Hosanna Cast" };

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
