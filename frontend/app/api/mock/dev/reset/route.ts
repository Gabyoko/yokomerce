import { resetDb } from "@/mocks/db";

/**
 * POST /dev/reset — vuelve la API de prueba a los datos iniciales.
 * Solo para las pruebas de Playwright en desarrollo; no existe en el contrato ni en producción.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "not_found", message: "No existe." }, { status: 404 });
  }
  resetDb();
  return Response.json({ ok: true });
}
