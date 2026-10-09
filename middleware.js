import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Rafraîchit la session et protège /control, /admin et /onboarding
export async function middleware(req) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getSession lit le cookie (et le renouvelle si besoin) sans appeler Supabase à chaque page ;
  // les pages /control et /admin vérifient ensuite l'utilisateur avec getUser.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/control/:path*", "/admin/:path*", "/onboarding"] };
