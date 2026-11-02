import type {
  Category,
  DeliveryZone,
  Order,
  Product,
  StockMovement,
  Store,
  Variant,
} from "@/shared/types";

/*
 * Registros de la base de datos en memoria. Se parecen a las tablas del backend (SPEC.md, sección 12):
 * guardan columnas internas (storeId, nextOrderNumber...) y el stock va aparte de las variantes.
 * Los tipos del contrato (Product con available, VariantAdmin...) se arman a partir de estos.
 */

export type StoreRecord = Store & {
  ownerName: string;
  nextOrderNumber: number;
};

export type ZoneRecord = DeliveryZone & { storeId: string };

export type CategoryRecord = Category & { storeId: string };

/** Sin variantes ni priceFromCents: se calculan al responder. */
export type ProductRecord = Omit<Product, "variants" | "priceFromCents"> & { storeId: string };

/** Sin available ni lowStock: salen del stock. */
export type VariantRecord = Omit<Variant, "available" | "lowStock"> & {
  productId: string;
  storeId: string;
  position: number;
};

export interface StockItemRecord {
  variantId: string;
  storeId: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number | null;
}

export type OrderRecord = Order & {
  storeId: string;
  deliveryZoneId: string | null;
};

export type StockMovementRecord = StockMovement & {
  storeId: string;
  orderId: string | null;
};

export interface MockDb {
  /** Momento en que se crearon los datos (las fechas de prueba son relativas a él). */
  seededAt: string;
  stores: StoreRecord[];
  zones: ZoneRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  variants: VariantRecord[];
  stockItems: StockItemRecord[];
  orders: OrderRecord[];
  movements: StockMovementRecord[];
}
