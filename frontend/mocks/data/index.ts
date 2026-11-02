import { dulcesDeAna } from "./dulcesdeana";
import { fundaLab } from "./fundalab";
import { tallerNorte } from "./tallernorte";

export { buildDatabase } from "./build";

/** Las tres tiendas de prueba (SPEC.md, sección 6). La primera es la tienda "mía" por defecto. */
export const SEED_STORES = [dulcesDeAna, tallerNorte, fundaLab];

export const DEFAULT_STORE_SLUG = dulcesDeAna.store.slug;
