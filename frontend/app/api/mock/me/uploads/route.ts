import { mockRoute } from "@/mocks/http";
import { badRequest } from "@/mocks/logic/errors";
import { getSessionStore } from "@/mocks/logic/session";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /me/uploads (multipart, campo "file") → { url } (201)
 * Fase F: no guarda el archivo; devuelve una imagen de prueba (SPEC.md, sección 5).
 */
export const POST = mockRoute(async (request, _ctx, { db }) => {
  getSessionStore(db, request);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Adjunta una imagen.", { fields: { file: "Adjunta una imagen." } });
  if (!file.type.startsWith("image/")) {
    throw badRequest("El archivo debe ser una imagen.", { fields: { file: "Debe ser una imagen." } });
  }
  if (file.size > MAX_BYTES) throw badRequest("La imagen pesa más de 5 MB.", { fields: { file: "Máximo 5 MB." } });

  // El parámetro hace única cada URL, como pasaría con archivos reales
  return Response.json({ url: `/mock/foto-de-prueba.svg?v=${crypto.randomUUID().slice(0, 8)}` }, { status: 201 });
});
