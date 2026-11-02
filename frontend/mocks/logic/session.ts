import { DEFAULT_STORE_SLUG } from "../data";
import type { MockDb, StoreRecord } from "../types";
import { MockApiError } from "./errors";

/** Cabecera que envía apiFetch con la tienda "mía" (SPEC.md, sección 5). */
export const MOCK_STORE_HEADER = "x-mock-store";

/**
 * Sesión simulada de la fase F: la tienda del dueño sale de la cabecera X-Mock-Store
 * (cookie mock_store). Sin cabecera se usa la tienda por defecto.
 */
export function getSessionStore(db: MockDb, request: Request): StoreRecord {
  const slug = request.headers.get(MOCK_STORE_HEADER) ?? DEFAULT_STORE_SLUG;
  const store = db.stores.find((s) => s.slug === slug);
  if (!store) throw new MockApiError(401, "unauthorized", "Tu sesión no es válida. Vuelve a ingresar.");
  return store;
}
