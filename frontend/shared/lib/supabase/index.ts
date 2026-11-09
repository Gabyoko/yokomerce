import type { SupabaseClient } from "@supabase/supabase-js";

export { SUPABASE } from "./config";

/**
 * Cliente de Supabase en el navegador. Se carga solo al usarlo (import dinámico): si se cargara
 * junto con la página, Next.js lo evaluaría al prerenderizar y la librería usa la hora al cargarse.
 */
export async function browserSupabase(): Promise<SupabaseClient> {
  return (await import("./browser")).browserClient();
}
