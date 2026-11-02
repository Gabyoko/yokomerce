import type { Catalog, DeliveryZone, Product, ProductAdmin, Variant, VariantAdmin } from "@/shared/types";

import type { MockDb, ProductRecord, StoreRecord, VariantRecord } from "../types";
import { notFound } from "./errors";
import { availableOf, getStockItem } from "./stock";
import { findStoreBySlug, toStore } from "./stores";

/**
 * Lo que se informa como disponible en productos por encargo: no llevan control de stock,
 * así que nunca aparecen agotados. Es el máximo que se puede pedir por línea.
 */
export const MADE_TO_ORDER_AVAILABLE = 99;

/** Por encargo solo si el producto lo es y la función está activa en la tienda. */
export function isMadeToOrder(product: ProductRecord, store: StoreRecord): boolean {
  return product.madeToOrder && store.features.madeToOrder;
}

function variantsOf(db: MockDb, productId: string): VariantRecord[] {
  return db.variants.filter((v) => v.productId === productId).sort((a, b) => a.position - b.position);
}

function toVariantAdmin(db: MockDb, variant: VariantRecord, madeToOrder: boolean): VariantAdmin {
  const stock = getStockItem(db, variant.id);
  const available = madeToOrder ? MADE_TO_ORDER_AVAILABLE : availableOf(stock);
  const threshold = madeToOrder ? null : stock.lowStockThreshold;
  return {
    id: variant.id,
    optionValueIds: variant.optionValueIds,
    label: variant.label,
    priceCents: variant.priceCents,
    available,
    lowStock: threshold !== null && available <= threshold,
    active: variant.active,
    onHand: stock.onHand,
    reserved: stock.reserved,
    lowStockThreshold: stock.lowStockThreshold,
  };
}

/** Variante con su stock, como la ve el dueño. */
export function getVariantAdmin(db: MockDb, variantId: string): VariantAdmin {
  const variant = db.variants.find((v) => v.id === variantId);
  const product = variant && db.products.find((p) => p.id === variant.productId);
  const store = product && db.stores.find((s) => s.id === product.storeId);
  if (!variant || !product || !store) throw notFound("No encontramos esta variante.");
  return toVariantAdmin(db, variant, isMadeToOrder(product, store));
}

function toVariant(admin: VariantAdmin): Variant {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onHand, reserved, lowStockThreshold, ...variant } = admin;
  return variant;
}

/** Precio más bajo entre variantes activas (si no hay activas, entre todas). */
function priceFrom(variants: { priceCents: number; active: boolean }[]): number {
  const pool = variants.some((v) => v.active) ? variants.filter((v) => v.active) : variants;
  return Math.min(...pool.map((v) => v.priceCents));
}

/** Producto como lo ve el dueño. Las funciones apagadas de la tienda no aparecen. */
export function toProductAdmin(db: MockDb, product: ProductRecord, store: StoreRecord): ProductAdmin {
  const madeToOrder = isMadeToOrder(product, store);
  const variants = variantsOf(db, product.id).map((v) => toVariantAdmin(db, v, madeToOrder));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { storeId, ...fields } = product;
  return {
    ...fields,
    madeToOrder,
    sizeGuideUrl: store.features.sizeGuide ? product.sizeGuideUrl : null,
    variants,
    priceFromCents: priceFrom(variants),
  };
}

/** Producto como lo ve el cliente: sin datos internos de stock. */
export function toProduct(db: MockDb, product: ProductRecord, store: StoreRecord): Product {
  const admin = toProductAdmin(db, product, store);
  return { ...admin, variants: admin.variants.map(toVariant) };
}

/** Zonas activas, solo si la tienda usa delivery por zonas. */
function activeZones(db: MockDb, store: StoreRecord): DeliveryZone[] {
  if (!store.features.deliveryZones) return [];
  return db.zones
    .filter((z) => z.storeId === store.id && z.active)
    .map(({ id, name, priceCents, active }) => ({ id, name, priceCents, active }));
}

/** GET /public/stores/:slug */
export function getCatalog(db: MockDb, slug: string): Catalog {
  const store = findStoreBySlug(db, slug);
  return {
    store: toStore(store),
    categories: db.categories
      .filter((c) => c.storeId === store.id)
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, position }) => ({ id, name, position })),
    products: db.products
      .filter((p) => p.storeId === store.id && p.visible)
      .sort((a, b) => a.position - b.position)
      .map((p) => toProduct(db, p, store)),
    deliveryZones: activeZones(db, store),
  };
}

/** GET /public/stores/:slug/products/:id — los productos ocultos no existen para el cliente. */
export function getPublicProduct(db: MockDb, slug: string, productId: string): Product {
  const store = findStoreBySlug(db, slug);
  const product = db.products.find((p) => p.id === productId && p.storeId === store.id && p.visible);
  if (!product) throw notFound("Este producto no existe o ya no está disponible.");
  return toProduct(db, product, store);
}
