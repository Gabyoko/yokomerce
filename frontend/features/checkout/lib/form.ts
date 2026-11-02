import { normalizePeruPhone } from "@/shared/lib/phone";
import type { CreateOrderInput, FulfillmentType, ISODate, PaymentMethod } from "@/shared/types";

import type { FulfillmentContext } from "./fulfillment";

/** Lo que escribe el cliente en el checkout. */
export type CheckoutForm = {
  name: string;
  phone: string;
  fulfillmentType: FulfillmentType | null;
  zoneId: string;
  city: string;
  address: string;
  reference: string;
  deliveryDate: ISODate | null;
  paymentMethod: PaymentMethod | null;
};

/**
 * Errores por campo. Las claves son las mismas que usa la API en `fields`
 * ("customer.phone", "fulfillment.zoneId"...), así los errores del servidor caen en el mismo lugar.
 */
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const CHECKOUT_FIELDS = [
  "customer.name",
  "customer.phone",
  "fulfillment.type",
  "fulfillment.zoneId",
  "fulfillment.city",
  "fulfillment.address",
  "fulfillment.reference",
  "deliveryDate",
  "paymentMethod",
] as const;
export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];

export const LIMITS = { nameMin: 2, nameMax: 60, address: 200, reference: 200, city: 60 } as const;

export type CheckoutContext = FulfillmentContext & {
  paymentMethods: PaymentMethod[];
  /** Días que se pueden elegir; vacío si la tienda no usa fecha de entrega. */
  dates: ISODate[];
};

export function initialForm(
  fulfillmentType: FulfillmentType | null,
  paymentMethods: PaymentMethod[],
): CheckoutForm {
  return {
    name: "",
    phone: "",
    fulfillmentType,
    zoneId: "",
    city: "",
    address: "",
    reference: "",
    deliveryDate: null,
    paymentMethod: paymentMethods.length === 1 ? (paymentMethods[0] ?? null) : null,
  };
}

/**
 * Revisa el formulario antes de enviarlo, con las mismas reglas de la API (SPEC.md, sección 7).
 * Solo sirve para avisar rápido: la API valida todo otra vez.
 */
export function validateCheckout(form: CheckoutForm, ctx: CheckoutContext): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = form.name.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors["customer.name"] = "Escribe tu nombre.";
  }
  if (!form.phone.trim()) errors["customer.phone"] = "Escribe tu celular.";
  else if (!normalizePeruPhone(form.phone)) errors["customer.phone"] = "Debe tener 9 dígitos y empezar con 9.";

  const type = form.fulfillmentType;
  if (!type) {
    errors["fulfillment.type"] = "Elige cómo quieres recibir tu pedido.";
  } else {
    if (type === "delivery" && !ctx.zones.some((z) => z.id === form.zoneId)) {
      errors["fulfillment.zoneId"] = "Elige tu distrito.";
    }
    if (type === "shipping" && !form.city.trim()) errors["fulfillment.city"] = "Escribe tu ciudad.";
    if (type !== "pickup" && !form.address.trim()) errors["fulfillment.address"] = "Escribe la dirección de entrega.";
  }

  if (ctx.dates.length > 0 && (!form.deliveryDate || !ctx.dates.includes(form.deliveryDate))) {
    errors.deliveryDate = "Elige el día de entrega.";
  }
  if (!form.paymentMethod || !ctx.paymentMethods.includes(form.paymentMethod)) {
    errors.paymentMethod = "Elige cómo vas a pagar.";
  }
  return errors;
}

/** Arma lo que se envía a POST /public/orders. Solo manda los datos de la forma de entrega elegida. */
export function buildOrderInput(
  storeSlug: string,
  items: CreateOrderInput["items"],
  form: CheckoutForm,
): CreateOrderInput {
  const type = form.fulfillmentType as FulfillmentType;
  const reference = form.reference.trim();
  const fulfillment: CreateOrderInput["fulfillment"] =
    type === "pickup"
      ? { type }
      : {
          type,
          ...(type === "delivery" ? { zoneId: form.zoneId } : { city: form.city.trim() }),
          address: form.address.trim(),
          ...(reference ? { reference } : {}),
        };

  return {
    storeSlug,
    items: items.map(({ variantId, quantity, customValues }) => ({ variantId, quantity, customValues })),
    customer: { name: form.name.trim(), phone: normalizePeruPhone(form.phone) ?? form.phone.trim() },
    fulfillment,
    ...(form.deliveryDate ? { deliveryDate: form.deliveryDate } : {}),
    paymentMethod: form.paymentMethod as PaymentMethod,
  };
}

/**
 * Separa los errores que devolvió la API: los de los campos del formulario
 * y el resto (productos del carrito, etc.), que se muestran juntos arriba.
 */
export function splitServerErrors(fields: Record<string, string>): { form: CheckoutErrors; other: string[] } {
  const form: CheckoutErrors = {};
  const other: string[] = [];
  for (const [key, message] of Object.entries(fields)) {
    if ((CHECKOUT_FIELDS as readonly string[]).includes(key)) form[key as CheckoutField] = message;
    else if (!other.includes(message)) other.push(message);
  }
  return { form, other };
}
