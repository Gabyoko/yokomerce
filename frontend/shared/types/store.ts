// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
import type { Cents, ISODateTime, PaymentMethod, PlanId, Weekday } from "./common";

export interface StoreFeatures {
  deliveryDate: boolean;
  leadTimeDays: number;
  madeToOrder: boolean;
  sizeGuide: boolean;
  deliveryZones: boolean;
  pickup: boolean;
  shipping: boolean;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  city: string;
  whatsapp: string;                    // "51912345678"
  businessHours: Record<Weekday, { open: string; close: string } | null>; // "09:00"
  paymentMethods: PaymentMethod[];
  paymentInstructions: string | null;  // ej. "Yape al 912 345 678 a nombre de Ana Torres"
  features: StoreFeatures;
  pickupAddress: string | null;
  shippingFeeCents: Cents | null;      // null = "a coordinar"
  reservationHours: number;            // 24 por defecto
  plan: PlanId;
  planExpiresAt: ISODateTime | null;
}

export interface DeliveryZone {
  id: string;
  name: string;                        // "Santiago de Surco"
  priceCents: Cents;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

// --- Entradas del panel (agregadas al contrato en la fase F2) ---

/** POST /me/store — registro. Las respuestas activan funciones (SPEC.md, sección 3). */
export interface CreateStoreInput {
  ownerName: string;
  name: string;
  slug: string;
  whatsapp: string;                    // celular de 9 dígitos; la API lo guarda con el prefijo 51
  city: string;
  answers: {
    deliveryDate: boolean;             // ¿Tus clientes eligen el día de entrega?
    madeToOrder: boolean;              // ¿Preparas productos por encargo? (sugiere leadTimeDays = 1)
    shipping: boolean;                 // ¿Haces envíos fuera de tu ciudad?
  };
}

/** PATCH /me/store — solo los campos que cambian. El slug no se puede cambiar. */
export type UpdateStoreInput = Partial<
  Pick<
    Store,
    | "name"
    | "description"
    | "logoUrl"
    | "coverUrl"
    | "city"
    | "whatsapp"
    | "businessHours"
    | "paymentMethods"
    | "paymentInstructions"
    | "pickupAddress"
    | "shippingFeeCents"
    | "reservationHours"
  >
> & { features?: Partial<StoreFeatures> };

/** PUT /me/zones — la lista completa; sin id = zona nueva; las que no vienen se borran. */
export interface ZoneInput {
  id?: string;
  name: string;
  priceCents: Cents;
  active: boolean;
}

/** PUT /me/categories — la lista completa en orden; sin id = nueva; las que no vienen se borran. */
export interface CategoryInput {
  id?: string;
  name: string;
}
