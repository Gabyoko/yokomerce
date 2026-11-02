// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
export type Cents = number;           // entero, S/ 45.00 = 4500
export type ISODate = string;         // "2026-10-31"
export type ISODateTime = string;     // "2026-10-29T15:28:00Z"
export type PaymentMethod = "yape" | "plin" | "cash" | "transfer";
export type FulfillmentType = "delivery" | "pickup" | "shipping";
export type OrderStatus = "new" | "paid" | "preparing" | "delivered" | "cancelled" | "expired";
export type PlanId = "free" | "pro";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
