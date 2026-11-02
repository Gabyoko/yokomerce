/** Dirección pública de la web, para links compartidos (mensaje de WhatsApp, Open Graph). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Link público de una tienda: "http://localhost:3000/dulcesdeana". */
export const storeUrl = (slug: string) => `${SITE_URL}/${slug}`;

/** El mismo link sin "https://", para mostrarlo: "yokomerce.pe/dulcesdeana". */
export const storeUrlLabel = (slug: string) => storeUrl(slug).replace(/^https?:\/\//, "");
