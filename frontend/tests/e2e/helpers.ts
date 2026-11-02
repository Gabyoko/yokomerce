import type { APIRequestContext, BrowserContext } from "@playwright/test";

export const API = "/api/mock";

/** Vuelve la API de prueba a los datos iniciales (solo existe en desarrollo). */
export async function resetApi(request: APIRequestContext) {
  const res = await request.post(`${API}/dev/reset`);
  if (!res.ok()) throw new Error(`No se pudo reiniciar la API de prueba (${res.status()})`);
}

/** Celular peruano distinto en cada llamada (la API limita 5 pedidos por hora por celular). */
export function randomPhone(): string {
  return `9${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

/** Sesión simulada de la fase F: elige qué tienda es "la mía" en el panel. */
export async function loginAs(context: BrowserContext, slug: string) {
  await context.addCookies([{ name: "mock_store", value: slug, url: "http://localhost:3000" }]);
}

type CatalogVariant = { id: string; label: string; available: number };
type CatalogProduct = { id: string; name: string; madeToOrder: boolean; variants: CatalogVariant[] };

/** Primer producto con stock y sin opciones ni campos extra de una tienda (para armar un carrito). */
export async function simpleProduct(request: APIRequestContext, slug: string) {
  const catalog = (await (await request.get(`${API}/public/stores/${slug}`)).json()) as {
    products: (CatalogProduct & { options: unknown[]; customFields: unknown[] })[];
  };
  const product = catalog.products.find(
    (p) => p.options.length === 0 && p.customFields.length === 0 && !p.madeToOrder && (p.variants[0]?.available ?? 0) > 2,
  );
  if (!product?.variants[0]) throw new Error(`La tienda ${slug} no tiene un producto simple con stock`);
  return { product, variant: product.variants[0] };
}

type StoreInfo = {
  features: { deliveryDate: boolean; leadTimeDays: number };
  businessHours: Record<string, unknown>;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Primera fecha de entrega válida (hoy en Lima + anticipación, en un día que atiende); undefined si no usa fecha. */
async function firstDeliveryDate(request: APIRequestContext, slug: string): Promise<string | undefined> {
  const { store } = (await (await request.get(`${API}/public/stores/${slug}`)).json()) as { store: StoreInfo };
  if (!store.features.deliveryDate) return undefined;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + store.features.leadTimeDays);
  for (let i = 0; i < 14 && !store.businessHours[WEEKDAYS[date.getUTCDay()]!]; i++) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Crea un pedido de recojo por la API pública y devuelve su token. */
export async function createPickupOrder(request: APIRequestContext, slug: string, variantId: string, name = "Lucía Ramos") {
  const res = await request.post(`${API}/public/orders`, {
    data: {
      storeSlug: slug,
      items: [{ variantId, quantity: 1, customValues: {} }],
      customer: { name, phone: randomPhone() },
      fulfillment: { type: "pickup" },
      deliveryDate: await firstDeliveryDate(request, slug),
      paymentMethod: "yape",
    },
  });
  const body = (await res.json()) as { ok: boolean; order?: { publicToken: string; number: number } };
  if (!body.ok || !body.order) throw new Error(`No se pudo crear el pedido: ${JSON.stringify(body)}`);
  return body.order;
}
