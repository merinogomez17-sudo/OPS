import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente con service_role. Solo para el servidor (Stripe). Devuelve null si no hay llave. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
