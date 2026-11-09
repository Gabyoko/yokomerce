/*
 * Cliente HTTP único (SPEC.md, sección 5). Ningún otro archivo hace fetch a la API.
 * Funciona en componentes de servidor y de cliente.
 * Al conectar el backend real (fase C) solo cambian NEXT_PUBLIC_API_URL y authHeaders().
 */
import { SUPABASE } from "@/shared/lib/supabase/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Cuerpo completo de la respuesta de error, ej. { error, message, items } en out_of_stock. */
    public body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Cookie que dice qué tienda de prueba es "la mía" en la fase F. */
export const MOCK_STORE_COOKIE = "mock_store";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("Falta NEXT_PUBLIC_API_URL. Cópiala de .env.example a .env.local.");

  // Con FormData (subir fotos) el navegador pone su propio Content-Type con el separador
  const contentType: Record<string, string> = init.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...contentType, ...(await authHeaders()), ...(init.headers as Record<string, string>) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body.error === "string" ? body.error : "unknown",
      typeof body.message === "string" ? body.message : "Algo salió mal",
      body,
    );
  }
  return res.json() as Promise<T>;
}

/** Valor de una cookie en el navegador. */
function readBrowserCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// Fase C (Supabase configurado): envía { "Authorization": "Bearer <token>" } de la sesión real.
// Fase F (sin Supabase): lee la cookie mock_store y envía { "X-Mock-Store": "<slug>" }.
// En el servidor la sesión sale de las cookies de la petición; en el navegador, del cliente de Supabase.
async function authHeaders(): Promise<Record<string, string>> {
  if (SUPABASE) {
    const token = await sessionToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  let store: string | undefined;
  if (typeof window === "undefined") {
    // Import dinámico: next/headers solo existe en el servidor
    const { cookies } = await import("next/headers");
    store = (await cookies()).get(MOCK_STORE_COOKIE)?.value;
  } else {
    store = readBrowserCookie(MOCK_STORE_COOKIE);
  }
  return store ? { "X-Mock-Store": decodeURIComponent(store) } : {};
}

/**
 * Token de la sesión de Supabase, o undefined si no hay sesión. El back verifica su firma;
 * aquí solo se lee. Imports dinámicos: cada lado carga solo su cliente.
 */
async function sessionToken(): Promise<string | undefined> {
  const supabase =
    typeof window === "undefined"
      ? await (await import("@/shared/lib/supabase/server")).serverSupabase()
      : await (await import("@/shared/lib/supabase")).browserSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
