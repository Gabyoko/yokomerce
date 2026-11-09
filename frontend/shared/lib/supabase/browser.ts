import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE } from "./config";

let client: SupabaseClient | undefined;

/** Cliente de Supabase en el navegador. Guarda la sesión en cookies para que el servidor también la lea. */
export function browserClient(): SupabaseClient {
  if (!SUPABASE) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.");
  client ??= createBrowserClient(SUPABASE.url, SUPABASE.key);
  return client;
}
