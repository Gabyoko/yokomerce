import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { SUPABASE } from "@/shared/lib/supabase/config";

/*
 * Corre antes de las páginas del panel, /ingresar y /registro (SPEC.md, sección 5, "Sesión"):
 * - Renueva la sesión de Supabase si está por vencer y guarda las cookies nuevas.
 * - Sin sesión, /panel lleva a /ingresar (y vuelve a la página pedida después).
 * - Con sesión, /ingresar lleva al panel.
 * Es solo comodidad: quien protege los datos es el back, que verifica el token en cada petición.
 */
export async function proxy(request: NextRequest) {
  // Fase F (sin Supabase): la sesión es la cookie de prueba, no hay nada que revisar
  if (!SUPABASE) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE.url, SUPABASE.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // getClaims verifica la firma del token (y lo renueva si venció); getSession solo lo leería
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && pathname.startsWith("/panel")) {
    return redirectKeepingCookies(request, response, "/ingresar", { next: pathname + search });
  }
  if (signedIn && pathname === "/ingresar") {
    return redirectKeepingCookies(request, response, "/panel");
  }
  return response;
}

/** Redirige sin perder las cookies de sesión que se acaban de renovar. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, path: string, params: Record<string, string> = {}) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/panel/:path*", "/ingresar", "/registro"],
};
