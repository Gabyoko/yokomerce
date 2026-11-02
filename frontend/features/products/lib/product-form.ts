import { centsToInput, parseSolesInput } from "@/shared/lib/money";
import type { ProductAdmin, ProductInput, StoreFeatures } from "@/shared/types";

/*
 * Formulario de producto (crear y editar). El borrador guarda lo que escribe el dueño;
 * las variantes se regeneran a partir de las opciones: una por combinación (SPEC.md, sección 3).
 */

export const PRODUCT_LIMITS = {
  name: 80,
  description: 1000,
  images: 5,
  options: 3,
  optionName: 30,
  optionValue: 30,
  valuesPerOption: 30,
  customFields: 5,
  fieldLabel: 40,
  fieldMaxLength: 200,
  stock: 99_999,
  /** Más combinaciones que esto se vuelve difícil de manejar en el celular. */
  variants: 100,
} as const;

export const DEFAULT_FIELD_MAX_LENGTH = 60;

/** Sugerencias genéricas para no escribir desde cero. El dueño puede crear cualquier opción. */
export const OPTION_SUGGESTIONS: { name: string; values: string[] }[] = [
  { name: "Talla", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { name: "Color", values: ["Negro", "Blanco", "Gris", "Azul", "Rojo", "Verde"] },
  { name: "Tamaño", values: ["Pequeño", "Mediano", "Grande"] },
  { name: "Sabor", values: [] },
  { name: "Modelo", values: [] },
  { name: "Material", values: [] },
];

export const FIELD_SUGGESTIONS = ["Dedicatoria", "Nombre para personalizar", "Indicaciones"];

export type OptionDraft = { key: string; id?: string; name: string; values: { id?: string; value: string }[] };

export type VariantDraft = {
  /** Valores de la combinación en minúsculas: identifica la fila al regenerar. */
  key: string;
  id?: string;
  values: string[];
  price: string;
  /** Solo en variantes nuevas: stock inicial. Las existentes cambian con ajustes. */
  stock: string;
  /** Stock actual de una variante que ya existe. */
  current?: { onHand: number; reserved: number };
  active: boolean;
};

export type FieldDraft = { key: string; id?: string; label: string; required: boolean; maxLength: string };

export type ProductDraft = {
  name: string;
  description: string;
  categoryId: string | null;
  images: string[];
  madeToOrder: boolean;
  sizeGuideUrl: string | null;
  visible: boolean;
  /** Precio y stock que se usan en la variante única o en las combinaciones nuevas. */
  price: string;
  stock: string;
  /** Aviso de stock bajo (para todas las variantes); vacío = sin aviso. */
  lowStockThreshold: string;
  options: OptionDraft[];
  variants: VariantDraft[];
  customFields: FieldDraft[];
};

export type ProductErrors = Record<string, string>;

let keyCount = 0;
export const newKey = (prefix: string) => `${prefix}-${++keyCount}`;

const comboKey = (values: string[]) => values.map((v) => v.trim().toLowerCase()).join("\u0000");

/** Todas las combinaciones: [["S","M"],["Negro"]] → [["S","Negro"],["M","Negro"]]. Sin opciones → [[]]. */
export function combinations(lists: string[][]): string[][] {
  return lists.reduce<string[][]>((acc, list) => acc.flatMap((combo) => list.map((value) => [...combo, value])), [[]]);
}

/** Opciones que cuentan para las combinaciones (con nombre y al menos un valor). */
const usableOptions = (options: OptionDraft[]) => options.filter((o) => o.name.trim() && o.values.length > 0);

/**
 * Vuelve a armar las variantes según las opciones: conserva las filas que ya existían
 * (precio, stock, id) y agrega las combinaciones nuevas con el precio y stock por defecto.
 */
export function syncVariants(draft: ProductDraft): ProductDraft {
  const combos = combinations(usableOptions(draft.options).map((o) => o.values.map((v) => v.value)));
  const previous = new Map(draft.variants.map((v) => [v.key, v]));
  const variants = combos.map((values): VariantDraft => {
    const key = comboKey(values);
    const existing = previous.get(key);
    if (existing) return { ...existing, values };
    return { key, values, price: draft.price, stock: draft.stock, active: true };
  });
  return { ...draft, variants };
}

export function emptyProductDraft(categoryId: string | null = null): ProductDraft {
  return syncVariants({
    name: "",
    description: "",
    categoryId,
    images: [],
    madeToOrder: false,
    sizeGuideUrl: null,
    visible: true,
    price: "",
    stock: "0",
    lowStockThreshold: "",
    options: [],
    variants: [],
    customFields: [],
  });
}

export function toProductDraft(product: ProductAdmin): ProductDraft {
  const prices = product.variants.map((v) => v.priceCents);
  const threshold = product.variants.find((v) => v.lowStockThreshold !== null)?.lowStockThreshold ?? null;
  return {
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    images: product.images,
    madeToOrder: product.madeToOrder,
    sizeGuideUrl: product.sizeGuideUrl,
    visible: product.visible,
    price: prices.length > 0 ? centsToInput(Math.min(...prices)) : "",
    stock: "0",
    lowStockThreshold: threshold === null ? "" : String(threshold),
    options: product.options.map((o) => ({
      key: o.id,
      id: o.id,
      name: o.name,
      values: o.values.map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: product.variants.map((v) => {
      const values = v.optionValueIds.map(
        (valueId) => product.options.flatMap((o) => o.values).find((ov) => ov.id === valueId)?.value ?? "",
      );
      return {
        key: comboKey(values),
        id: v.id,
        values,
        price: centsToInput(v.priceCents),
        stock: "0",
        current: { onHand: v.onHand, reserved: v.reserved },
        active: v.active,
      };
    }),
    customFields: product.customFields.map((f) => ({
      key: f.id,
      id: f.id,
      label: f.label,
      required: f.required,
      maxLength: String(f.maxLength),
    })),
  };
}

// ---------------------------------------------------------------------------
// Cambios en las opciones (cada uno regenera las variantes)

export function addOption(draft: ProductDraft, name = "", values: string[] = []): ProductDraft {
  if (draft.options.length >= PRODUCT_LIMITS.options) return draft;
  const option: OptionDraft = { key: newKey("op"), name, values: values.map((value) => ({ value })) };
  return syncVariants({ ...draft, options: [...draft.options, option] });
}

export function removeOption(draft: ProductDraft, index: number): ProductDraft {
  return syncVariants({ ...draft, options: draft.options.filter((_, i) => i !== index) });
}

export function renameOption(draft: ProductDraft, index: number, name: string): ProductDraft {
  return syncVariants({ ...draft, options: draft.options.map((o, i) => (i === index ? { ...o, name } : o)) });
}

/** Agrega uno o varios valores ("S, M, L" se separa por comas). Ignora vacíos y repetidos. */
export function addOptionValues(draft: ProductDraft, index: number, text: string): ProductDraft {
  const option = draft.options[index];
  if (!option) return draft;
  const values = [...option.values];
  for (const raw of text.split(",")) {
    const value = raw.trim().slice(0, PRODUCT_LIMITS.optionValue);
    if (!value || values.some((v) => v.value.toLowerCase() === value.toLowerCase())) continue;
    if (values.length >= PRODUCT_LIMITS.valuesPerOption) break;
    values.push({ value });
  }
  return syncVariants({ ...draft, options: draft.options.map((o, i) => (i === index ? { ...o, values } : o)) });
}

export function removeOptionValue(draft: ProductDraft, index: number, valueIndex: number): ProductDraft {
  return syncVariants({
    ...draft,
    options: draft.options.map((o, i) => (i === index ? { ...o, values: o.values.filter((_, j) => j !== valueIndex) } : o)),
  });
}

/**
 * Cambia el precio o stock por defecto. Sin opciones, es el de la variante única;
 * con opciones, se usa en las combinaciones nuevas.
 */
export function setDefaults(draft: ProductDraft, change: { price?: string; stock?: string }): ProductDraft {
  const single = draft.variants.length === 1 && draft.variants[0]!.values.length === 0;
  return {
    ...draft,
    ...change,
    variants: single
      ? draft.variants.map((v) => ({
          ...v,
          ...(change.price !== undefined ? { price: change.price } : {}),
          ...(change.stock !== undefined && !v.id ? { stock: change.stock } : {}),
        }))
      : draft.variants,
  };
}

/** Pone el mismo precio (y stock inicial, si se da) en todas las combinaciones. */
export function applyToAllVariants(draft: ProductDraft, change: { price?: string; stock?: string }): ProductDraft {
  return {
    ...draft,
    ...(change.price !== undefined ? { price: change.price } : {}),
    ...(change.stock !== undefined ? { stock: change.stock } : {}),
    variants: draft.variants.map((v) => ({
      ...v,
      ...(change.price !== undefined ? { price: change.price } : {}),
      ...(change.stock !== undefined && !v.id ? { stock: change.stock } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Validación y envío

const wholeNumber = (value: string, max: number): number | null => {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n <= max ? n : null;
};

/** Revisa el borrador con las reglas de la API. Las claves son las de la API. */
export function validateProduct(draft: ProductDraft, features: Pick<StoreFeatures, "madeToOrder" | "sizeGuide">): ProductErrors {
  const errors: ProductErrors = {};
  const L = PRODUCT_LIMITS;
  const name = draft.name.trim();
  if (name.length < 2 || name.length > L.name) errors.name = `Escribe el nombre del producto (de 2 a ${L.name} letras).`;
  if (draft.description.trim().length > L.description) errors.description = `Máximo ${L.description} letras.`;
  if (draft.images.length > L.images) errors.images = `Máximo ${L.images} fotos.`;
  if (draft.madeToOrder && !features.madeToOrder) errors.madeToOrder = "Activa los pedidos por encargo en Configuración.";
  if (draft.sizeGuideUrl && !features.sizeGuide) errors.sizeGuideUrl = "Activa la guía de tallas en Configuración.";

  const optionNames = new Set<string>();
  draft.options.forEach((option, i) => {
    const optionName = option.name.trim();
    if (!optionName || optionName.length > L.optionName) errors[`options.${i}.name`] = "Escribe el nombre de la opción.";
    else if (optionNames.has(optionName.toLowerCase())) errors[`options.${i}.name`] = "Ya tienes una opción con este nombre.";
    optionNames.add(optionName.toLowerCase());
    if (option.values.length === 0) errors[`options.${i}.values`] = "Agrega al menos un valor.";
  });
  if (draft.variants.length > L.variants) {
    errors.options = `Son ${draft.variants.length} combinaciones; el máximo es ${L.variants}. Quita algunos valores.`;
  }

  if (draft.variants.length === 0) errors.variants = "Agrega al menos un valor a cada opción.";
  draft.variants.forEach((variant, i) => {
    if (parseSolesInput(variant.price) === null) errors[`variants.${i}.priceCents`] = "Escribe el precio.";
    if (!draft.madeToOrder && !variant.id && wholeNumber(variant.stock, L.stock) === null) {
      errors[`variants.${i}.initialStock`] = "Escribe cuántos tienes (0 o más).";
    }
  });
  if (draft.variants.length > 0 && draft.variants.every((v) => !v.active)) {
    errors.variants = "Deja al menos una combinación activa.";
  }
  if (!draft.madeToOrder && draft.lowStockThreshold.trim() && wholeNumber(draft.lowStockThreshold, L.stock) === null) {
    errors.lowStockThreshold = "Escribe un número (0 o más) o déjalo vacío.";
  }

  const labels = new Set<string>();
  draft.customFields.forEach((field, i) => {
    const label = field.label.trim();
    if (!label || label.length > L.fieldLabel) errors[`customFields.${i}.label`] = "Escribe el nombre del campo.";
    else if (labels.has(label.toLowerCase())) errors[`customFields.${i}.label`] = "Este campo está repetido.";
    labels.add(label.toLowerCase());
    const max = wholeNumber(field.maxLength, L.fieldMaxLength);
    if (max === null || max < 1) errors[`customFields.${i}.maxLength`] = `De 1 a ${L.fieldMaxLength} letras.`;
  });
  return errors;
}

/** Arma POST /me/products o PUT /me/products/:id. Llamar solo con un borrador válido. */
export function toProductInput(draft: ProductDraft): ProductInput {
  const threshold = draft.madeToOrder || !draft.lowStockThreshold.trim() ? null : Number(draft.lowStockThreshold);
  return {
    categoryId: draft.categoryId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    images: draft.images,
    madeToOrder: draft.madeToOrder,
    sizeGuideUrl: draft.sizeGuideUrl,
    visible: draft.visible,
    options: usableOptions(draft.options).map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      name: o.name.trim(),
      values: o.values.map((v) => ({ ...(v.id ? { id: v.id } : {}), value: v.value })),
    })),
    variants: draft.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      optionValues: v.values,
      priceCents: parseSolesInput(v.price) ?? 0,
      active: v.active,
      lowStockThreshold: threshold,
      ...(!v.id && !draft.madeToOrder ? { initialStock: Number(v.stock) } : {}),
    })),
    customFields: draft.customFields.map((f) => ({
      ...(f.id ? { id: f.id } : {}),
      label: f.label.trim(),
      required: f.required,
      maxLength: Number(f.maxLength),
    })),
  };
}

/** Nombre de una combinación para mostrar: ["Negro","M"] → "Negro / M"; sin opciones → "". */
export const variantLabel = (values: string[]) => values.join(" / ");
