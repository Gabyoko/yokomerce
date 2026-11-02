// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
import type { Cents } from "./common";
import type { Category, DeliveryZone, Store } from "./store";

export interface OptionValue { id: string; value: string }               // "M"
export interface ProductOption { id: string; name: string; values: OptionValue[] } // "Talla"

export interface CustomField {
  id: string;
  label: string;                       // "Dedicatoria"
  required: boolean;
  maxLength: number;                   // 60 por defecto
}

/** Variante tal como la ve el cliente */
export interface Variant {
  id: string;
  optionValueIds: string[];            // vacío en la variante por defecto
  label: string;                       // "Negro / M"
  priceCents: Cents;
  available: number;                   // onHand - reserved
  lowStock: boolean;                   // available <= lowStockThreshold
  active: boolean;
}

/** Variante tal como la ve el dueño en el panel */
export interface VariantAdmin extends Variant {
  onHand: number;                      // "En total"
  reserved: number;
  lowStockThreshold: number | null;
}

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  images: string[];                    // máximo 5
  madeToOrder: boolean;                // sin control de stock
  sizeGuideUrl: string | null;
  visible: boolean;
  position: number;
  options: ProductOption[];
  variants: Variant[];
  customFields: CustomField[];
  priceFromCents: Cents;               // precio más bajo entre variantes activas
}

export interface ProductAdmin extends Omit<Product, "variants"> {
  variants: VariantAdmin[];
}

export interface Catalog {
  store: Store;
  categories: Category[];
  products: Product[];                 // solo visibles
  deliveryZones: DeliveryZone[];       // solo activas
}

// --- Entradas del panel (agregadas al contrato en la fase F2) ---

/**
 * POST /me/products y PUT /me/products/:id.
 * Las variantes se identifican por sus valores de opción (texto), porque los valores nuevos
 * todavía no tienen id. Debe venir exactamente una variante por combinación.
 */
export interface ProductInput {
  categoryId: string | null;
  name: string;
  description: string;
  images: string[];                    // máximo 5
  madeToOrder: boolean;
  sizeGuideUrl: string | null;
  visible: boolean;
  options: { id?: string; name: string; values: { id?: string; value: string }[] }[]; // máximo 3
  variants: {
    id?: string;
    optionValues: string[];            // ["Negro", "M"] en el orden de options; vacío en la variante por defecto
    priceCents: Cents;
    active: boolean;
    lowStockThreshold: number | null;
    initialStock?: number;             // solo en variantes nuevas; después el stock cambia con ajustes
  }[];
  customFields: { id?: string; label: string; required: boolean; maxLength: number }[];
}
