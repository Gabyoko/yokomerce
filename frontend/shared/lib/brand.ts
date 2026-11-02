/**
 * Nombre de la marca. Para cambiarlo, edita solo este archivo (y NEXT_PUBLIC_SITE_URL en .env).
 * `domain` es el que se muestra en ejemplos y textos; los links reales salen de NEXT_PUBLIC_SITE_URL.
 */
export const BRAND = {
  name: "Yokomerce",
  /** Cómo se escribe en el logo (en minúsculas, seguido de un punto de color). */
  logo: "yokomerce",
  domain: "yokomerce.pe",
  /** Prefijo de lo que se guarda en el navegador (carrito, preferencias). */
  storagePrefix: "yokomerce",
  /** Tienda que se muestra en la landing como ejemplo ("Ver tienda de ejemplo"). */
  demoStoreSlug: "dulcesdeana",
} as const;

/** Título de pestaña: "Pedidos · Yokomerce". */
export const pageTitle = (section: string) => `${section} · ${BRAND.name}`;
