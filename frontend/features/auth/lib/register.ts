import { slugProblem } from "@/features/store-settings";
import { parseSolesInput } from "@/shared/lib/money";
import { normalizePeruPhone } from "@/shared/lib/phone";
import type { CreateStoreInput, ZoneInput } from "@/shared/types";

/** Registro en 3 pasos: tu nombre, tu tienda y 4 preguntas (SPEC.md, sección 3). */
export const REGISTER_STEPS = 3;

export type Answer = boolean | null;

export type RegisterDraft = {
  ownerName: string;
  name: string;
  slug: string;
  whatsapp: string;
  city: string;
  delivery: boolean;
  zones: { key: string; name: string; price: string }[];
  answers: { deliveryDate: Answer; madeToOrder: Answer; variants: Answer; shipping: Answer };
};

/** Estado del link mientras se escribe: lo confirma la API. */
export type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";

export type RegisterErrors = Record<string, string>;

export const QUESTIONS: { key: keyof RegisterDraft["answers"]; question: string; hint: string }[] = [
  {
    key: "deliveryDate",
    question: "¿Tus clientes eligen el día de entrega?",
    hint: "Al pedir, escogen la fecha de entrega.",
  },
  {
    key: "madeToOrder",
    question: "¿Preparas productos por encargo?",
    hint: "Productos sin stock que haces cuando te los piden. Pediremos 1 día de anticipación.",
  },
  {
    key: "variants",
    question: "¿Tus productos tienen variantes como talla, color o tamaño?",
    hint: "Te mostraremos cómo crearlas al subir tus productos.",
  },
  {
    key: "shipping",
    question: "¿Haces envíos fuera de tu ciudad?",
    hint: "El cliente indica su ciudad y coordinas el envío.",
  },
];

export const emptyRegisterDraft = (): RegisterDraft => ({
  ownerName: "",
  name: "",
  slug: "",
  whatsapp: "",
  city: "",
  delivery: false,
  zones: [],
  answers: { deliveryDate: null, madeToOrder: null, variants: null, shipping: null },
});

/** Errores del paso actual (1, 2 o 3). Las claves son las de la API cuando existen. */
export function validateRegisterStep(step: number, draft: RegisterDraft, slugStatus: SlugStatus): RegisterErrors {
  const errors: RegisterErrors = {};
  if (step === 1) {
    const owner = draft.ownerName.trim();
    if (owner.length < 2 || owner.length > 60) errors.ownerName = "Escribe tu nombre.";
  }
  if (step === 2) {
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 60) errors.name = "Escribe el nombre de tu negocio (de 2 a 60 letras).";
    const problem = slugProblem(draft.slug);
    if (problem) errors.slug = problem;
    else if (slugStatus === "taken") errors.slug = "Este link ya está en uso. Prueba con otro.";
    else if (slugStatus === "checking" || slugStatus === "idle") errors.slug = "Espera, estamos revisando el link.";
    if (!normalizePeruPhone(draft.whatsapp)) errors.whatsapp = "Escribe un celular de 9 dígitos que empiece con 9.";
    const city = draft.city.trim();
    if (!city || city.length > 60) errors.city = "Escribe tu ciudad o distrito.";
    if (draft.delivery) {
      if (draft.zones.length === 0) errors.zones = "Agrega al menos una zona o apaga el delivery.";
      draft.zones.forEach((zone, i) => {
        if (!zone.name.trim()) errors[`zones.${i}.name`] = "Escribe el distrito.";
        if (parseSolesInput(zone.price) === null) errors[`zones.${i}.priceCents`] = "Escribe el precio.";
      });
    }
  }
  if (step === 3) {
    for (const { key } of QUESTIONS) {
      if (draft.answers[key] === null) errors[`answers.${key}`] = "Elige sí o no.";
    }
  }
  return errors;
}

/** POST /me/store. La pregunta de variantes no va a la API (solo muestra ayuda en productos). */
export function createStoreInput(draft: RegisterDraft): CreateStoreInput {
  return {
    ownerName: draft.ownerName.trim(),
    name: draft.name.trim(),
    slug: draft.slug,
    whatsapp: normalizePeruPhone(draft.whatsapp) ?? draft.whatsapp,
    city: draft.city.trim(),
    answers: {
      deliveryDate: draft.answers.deliveryDate === true,
      madeToOrder: draft.answers.madeToOrder === true,
      shipping: draft.answers.shipping === true,
    },
  };
}

/** Zonas de delivery del registro para PUT /me/zones (vacío si no hace delivery). */
export function registerZones(draft: RegisterDraft): ZoneInput[] {
  if (!draft.delivery) return [];
  return draft.zones.map((zone) => ({ name: zone.name.trim(), priceCents: parseSolesInput(zone.price) ?? 0, active: true }));
}
