import { buildDatabase, SEED_STORES } from "./data";
import type { MockDb } from "./types";

/*
 * Base de datos en memoria de la API de prueba (fase F).
 *
 * Vive en globalThis para que sobreviva a las recargas de código en desarrollo
 * (cada recarga vuelve a evaluar los módulos, pero globalThis se mantiene).
 * Al reiniciar el servidor vuelve a los datos iniciales.
 */

const globalForDb = globalThis as typeof globalThis & { __yokomerceMockDb?: MockDb };

/** La base de datos actual. Se crea con los datos de prueba la primera vez que se pide. */
export function getDb(): MockDb {
  globalForDb.__yokomerceMockDb ??= buildDatabase(SEED_STORES);
  return globalForDb.__yokomerceMockDb;
}

/** Vuelve a los datos iniciales. Las fechas de prueba se calculan relativas a `now`. */
export function resetDb(now: Date = new Date()): MockDb {
  globalForDb.__yokomerceMockDb = buildDatabase(SEED_STORES, now);
  return globalForDb.__yokomerceMockDb;
}

export type * from "./types";
