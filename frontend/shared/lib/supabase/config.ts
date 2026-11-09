/*
 * Datos públicos del proyecto de Supabase Auth (SPEC.md, sección 5, "Sesión").
 * Si no están en .env.local, la app usa la sesión de prueba de la fase F (cookie mock_store).
 * Se escriben completos (process.env.NEXT_PUBLIC_...) para que Next.js los incluya en el navegador.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE = url && key ? { url, key } : null;
