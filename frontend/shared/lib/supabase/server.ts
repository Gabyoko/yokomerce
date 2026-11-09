import { SUPABASE } from "./config";

/**
 * Cliente de Supabase en componentes de servidor: lee la sesión de las cookies.
 * Aquí no se pueden escribir cookies; las renueva proxy.ts antes de llegar a la página.
 *
 * Las cookies se leen ANTES de cargar @supabase/ssr: así Next.js sabe que la página depende de
 * la petición y no intenta prerenderizarla (la librería usa la hora al cargarse).
 * Imports dinámicos: apiFetch también se usa en el navegador, donde next/headers no existe.
 */
export async function serverSupabase() {
  if (!SUPABASE) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.");
  const { cookies } = await import("next/headers");
  const store = await cookies();
  // Supabase mira la hora para saber si el token venció. connection() le dice a Next.js que esto
  // depende de cada visita: sin esto, al preparar el panel por adelantado avisa del uso de la hora.
  const { connection } = await import("next/server");
  await connection();
  const { createServerClient } = await import("@supabase/ssr");
  return createServerClient(SUPABASE.url, SUPABASE.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Componente de servidor: no puede escribir cookies. proxy.ts ya renovó la sesión.
        }
      },
    },
  });
}
