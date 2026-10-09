import { createClient } from "@supabase/supabase-js";

// Client « service » : contourne les règles d'accès. À n'utiliser QUE côté serveur (routes /api), jamais dans le navigateur.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
