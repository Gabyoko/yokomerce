import type {
  CustomField,
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
  Store,
  StoreFeatures,
} from "@/shared/types";

/*
 * Formato de los datos de prueba. Es declarativo y fácil de leer: build.ts lo convierte en la
 * base de datos (ids, totales, fechas en Lima y movimientos de stock coherentes).
 */

export type SeedVariant = {
  /** Valores de opción en el mismo orden que las opciones del producto. Vacío = variante por defecto. */
  values: string[];
  priceCents: number;
  /** Disponible al momento de crear los datos (después de aplicar todos los pedidos). */
  available: number;
  lowStockThreshold?: number | null;
  active?: boolean;
};

export type SeedProduct = {
  key: string;
  category: string;
  name: string;
  description: string;
  madeToOrder?: boolean;
  sizeGuideUrl?: string | null;
  visible?: boolean;
  images?: string[];
  options?: { name: string; values: string[] }[];
  customFields?: Omit<CustomField, "id">[];
  variants: SeedVariant[];
};

export type SeedOrderItem = {
  product: string;
  /** Valores de la variante; omitir en productos sin opciones. */
  variant?: string[];
  quantity: number;
  /** Por etiqueta del campo extra: { "Dedicatoria": "..." }. */
  customValues?: Record<string, string>;
};

export type SeedOrder = {
  /** Hace cuántas horas se creó (máximo 7 días). */
  hoursAgo: number;
  /**
   * Estado actual. "cancelled" usa `cancelledFrom` para saber si se canceló antes o después de pagar.
   * "expired" debe tener más horas que la reserva de la tienda.
   */
  status: OrderStatus;
  cancelledFrom?: "new" | "paid";
  customer: { name: string; phone: string };
  fulfillment: {
    type: FulfillmentType;
    zone?: string;
    city?: string;
    address?: string;
    reference?: string;
  };
  /**
   * Horas desde la creación hasta la entrega. Define deliveryDate (tiendas con fecha de entrega)
   * y deliveredAt (pedidos entregados).
   */
  deliverAfterHours?: number;
  /** Minutos desde la creación hasta que el negocio confirmó el pago. */
  paidAfterMinutes?: number;
  paymentMethod: PaymentMethod;
  items: SeedOrderItem[];
  notes?: string;
};

/** Ingresos o salidas manuales del dueño (feria, merma...). */
export type SeedAdjustment = {
  product: string;
  variant?: string[];
  type: "in" | "out";
  quantity: number;
  reason: string;
  hoursAgo: number;
};

export type SeedStore = {
  /** Prefijo corto para los ids de esta tienda, ej. "da". */
  idPrefix: string;
  store: Omit<Store, "id" | "features" | "planExpiresAt"> & {
    features: StoreFeatures;
    /** Días hasta que vence el plan; null = sin vencimiento. */
    planExpiresInDays: number | null;
  };
  ownerName: string;
  zones: { name: string; priceCents: number; active?: boolean }[];
  categories: string[];
  products: SeedProduct[];
  firstOrderNumber: number;
  /** En orden cronológico: el primero recibe firstOrderNumber. */
  orders: SeedOrder[];
  adjustments?: SeedAdjustment[];
};
