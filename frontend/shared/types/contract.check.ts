/*
 * Verificación del contrato (SPEC.md, etapa C1). No se ejecuta: TypeScript la revisa al compilar
 * (`npm run typecheck`). Si front y back dejan de coincidir, este archivo da error y dice en qué tipo.
 *
 * - Respuestas: el tipo del back (generated.ts, sacado de su OpenAPI) y el del front deben ser iguales:
 *   ni campos de más ni de menos, ni null donde el otro no lo espera.
 * - Entradas: todo lo que el front puede mandar debe ser aceptado por el back.
 *
 * Para regenerar generated.ts después de cambiar el back: `npm run contract`.
 */
import type { components } from "./generated";
import type {
  Catalog,
  Category,
  CategoryInput,
  CreateOrderInput,
  CreateOrderResult,
  CreateStoreInput,
  CustomField,
  DashboardStats,
  DeliveryZone,
  OptionValue,
  Order,
  OrderItem,
  Product,
  ProductAdmin,
  ProductInput,
  ProductOption,
  PublicOrder,
  StockAdjustmentInput,
  StockAdjustmentResult,
  StockMovement,
  Store,
  StoreFeatures,
  UpdateStoreInput,
  Variant,
  VariantAdmin,
  ZoneInput,
} from "./index";

type Back = components["schemas"];

/** Mismo tipo en ambos sentidos. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Lo que manda el front cabe en lo que acepta el back. */
type Accepts<BackInput, FrontInput> = [FrontInput] extends [BackInput] ? true : false;

type Expect<T extends true> = T;

// --- Respuestas ---
export type ContractResponses = [
  Expect<Same<Back["Store"], Store>>,
  Expect<Same<Back["StoreFeatures"], StoreFeatures>>,
  Expect<Same<Back["DeliveryZone"], DeliveryZone>>,
  Expect<Same<Back["Category"], Category>>,
  Expect<Same<Back["OptionValue"], OptionValue>>,
  Expect<Same<Back["ProductOption"], ProductOption>>,
  Expect<Same<Back["CustomField"], CustomField>>,
  Expect<Same<Back["Variant"], Variant>>,
  Expect<Same<Back["VariantAdmin"], VariantAdmin>>,
  Expect<Same<Back["Product"], Product>>,
  Expect<Same<Back["ProductAdmin"], ProductAdmin>>,
  Expect<Same<Back["Catalog"], Catalog>>,
  Expect<Same<Back["OrderItem"], OrderItem>>,
  Expect<Same<Back["PublicOrder"], PublicOrder>>,
  Expect<Same<Back["Order"], Order>>,
  Expect<Same<Back["CreateOrderSuccess"], Extract<CreateOrderResult, { ok: true }>>>,
  Expect<Same<Back["StockMovement"], StockMovement>>,
  Expect<Same<Back["StockAdjustmentResult"], StockAdjustmentResult>>,
  Expect<Same<Back["DashboardStats"], DashboardStats>>,
  Expect<Same<Back["UploadedImage"], { url: string }>>,
  Expect<Same<Back["SlugAvailability"], { available: boolean }>>,
];

// --- Entradas ---
export type ContractInputs = [
  Expect<Accepts<Back["CreateOrderInput"], CreateOrderInput>>,
  Expect<Accepts<Back["CreateStoreInput"], CreateStoreInput>>,
  Expect<Accepts<Back["UpdateStoreInput"], UpdateStoreInput>>,
  Expect<Accepts<Back["ZoneInput"], ZoneInput>>,
  Expect<Accepts<Back["CategoryInput"], CategoryInput>>,
  Expect<Accepts<Back["ProductInput"], ProductInput>>,
  Expect<Accepts<Back["StockAdjustmentInput"], StockAdjustmentInput>>,
  Expect<Accepts<Back["OrderNotesInput"], { notes: string | null }>>,
  Expect<Accepts<Back["ProductVisibilityInput"], { visible: boolean }>>,
];
