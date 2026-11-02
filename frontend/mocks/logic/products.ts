import { getLimit } from "@/features/plans";
import type { Category, ProductAdmin, ProductOption } from "@/shared/types";

import { combinations } from "../data/helpers";
import type { CategoryRecord, MockDb, ProductRecord, StoreRecord, VariantRecord } from "../types";
import { toProductAdmin } from "./catalog";
import { badRequest, conflict, MockApiError, notFound } from "./errors";
import { recordStockMovement } from "./stock";
import { FieldErrors, isInt, isObject, text } from "./validation";

const LIMITS = {
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
  category: 40,
  stock: 99_999,
  priceCents: 10_000_000,
};

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

function toCategory(category: CategoryRecord): Category {
  return { id: category.id, name: category.name, position: category.position };
}

/** GET /me/categories */
export function listCategories(db: MockDb, store: StoreRecord): Category[] {
  return db.categories
    .filter((c) => c.storeId === store.id)
    .sort((a, b) => a.position - b.position)
    .map(toCategory);
}

/** PUT /me/categories — lista completa en orden. Los productos de una categoría borrada quedan sin categoría. */
export function saveCategories(db: MockDb, store: StoreRecord, input: unknown): Category[] {
  if (!Array.isArray(input)) throw badRequest("La lista de categorías no es válida.");
  const errors = new FieldErrors();
  const current = db.categories.filter((c) => c.storeId === store.id);
  const seen: string[] = [];

  const next: CategoryRecord[] = input.map((raw: unknown, position) => {
    const category = isObject(raw) ? raw : {};
    const name = text(category.name);
    if (!name || name.length > LIMITS.category) errors.add(`${position}.name`, "Escribe el nombre de la categoría.");
    else if (seen.some((n) => sameText(n, name))) errors.add(`${position}.name`, "Esta categoría está repetida.");
    seen.push(name);
    const existing = typeof category.id === "string" ? current.find((c) => c.id === category.id) : undefined;
    if (category.id !== undefined && !existing) errors.add(`${position}.id`, "Esta categoría no existe.");
    return { id: existing?.id ?? `ct_${crypto.randomUUID()}`, storeId: store.id, name, position };
  });
  errors.throwIfAny("Revisa las categorías.");

  const keptIds = new Set(next.map((c) => c.id));
  for (const product of db.products) {
    if (product.storeId === store.id && product.categoryId && !keptIds.has(product.categoryId)) product.categoryId = null;
  }
  db.categories = [...db.categories.filter((c) => c.storeId !== store.id), ...next];
  return next.map(toCategory);
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

/** GET /me/products — todos, también los ocultos. */
export function listProducts(db: MockDb, store: StoreRecord): ProductAdmin[] {
  return db.products
    .filter((p) => p.storeId === store.id)
    .sort((a, b) => a.position - b.position)
    .map((p) => toProductAdmin(db, p, store));
}

export function findOwnProduct(db: MockDb, store: StoreRecord, productId: string): ProductRecord {
  const product = db.products.find((p) => p.id === productId && p.storeId === store.id);
  if (!product) throw notFound("No encontramos este producto.");
  return product;
}

/** GET /me/products/:id */
export function getProductAdmin(db: MockDb, store: StoreRecord, productId: string): ProductAdmin {
  return toProductAdmin(db, findOwnProduct(db, store, productId), store);
}

type ParsedVariant = {
  id?: string;
  values: string[];
  priceCents: number;
  active: boolean;
  lowStockThreshold: number | null;
  initialStock: number;
};

type ParsedProduct = {
  categoryId: string | null;
  name: string;
  description: string;
  images: string[];
  madeToOrder: boolean;
  sizeGuideUrl: string | null;
  visible: boolean;
  options: { id?: string; name: string; values: { id?: string; value: string }[] }[];
  variants: ParsedVariant[];
  customFields: { id?: string; label: string; required: boolean; maxLength: number }[];
};

/** Valida un ProductInput. Las funciones apagadas de la tienda se rechazan. */
function parseProduct(db: MockDb, store: StoreRecord, input: unknown): ParsedProduct {
  const body = isObject(input) ? input : {};
  const errors = new FieldErrors();

  const name = text(body.name);
  if (name.length < 2 || name.length > LIMITS.name) errors.add("name", "Escribe el nombre del producto (de 2 a 80 letras).");
  const description = text(body.description);
  if (description.length > LIMITS.description) errors.add("description", "Máximo 1000 letras.");

  const images = Array.isArray(body.images) ? body.images.map(text) : [];
  if (!Array.isArray(body.images) || images.some((url) => !url)) errors.add("images", "Las fotos no son válidas.");
  else if (images.length > LIMITS.images) errors.add("images", `Máximo ${LIMITS.images} fotos.`);

  const categoryId = body.categoryId === null || body.categoryId === undefined ? null : text(body.categoryId);
  if (categoryId && !db.categories.some((c) => c.id === categoryId && c.storeId === store.id)) {
    errors.add("categoryId", "Elige una categoría de tu tienda.");
  }

  const madeToOrder = body.madeToOrder === true;
  if (madeToOrder && !store.features.madeToOrder) errors.add("madeToOrder", "Activa los pedidos por encargo en Configuración.");
  const sizeGuideUrl = body.sizeGuideUrl === null || body.sizeGuideUrl === undefined ? null : text(body.sizeGuideUrl) || null;
  if (sizeGuideUrl && !store.features.sizeGuide) errors.add("sizeGuideUrl", "Activa la guía de tallas en Configuración.");
  const visible = body.visible !== false;

  // Opciones
  const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : [];
  if (rawOptions.length > LIMITS.options) errors.add("options", `Máximo ${LIMITS.options} opciones por producto.`);
  const options = rawOptions.map((raw, i) => {
    const option = isObject(raw) ? raw : {};
    const optionName = text(option.name);
    if (!optionName || optionName.length > LIMITS.optionName) errors.add(`options.${i}.name`, "Escribe el nombre de la opción.");
    const rawValues: unknown[] = Array.isArray(option.values) ? option.values : [];
    if (rawValues.length === 0) errors.add(`options.${i}.values`, "Agrega al menos un valor.");
    if (rawValues.length > LIMITS.valuesPerOption) errors.add(`options.${i}.values`, "Demasiados valores.");
    const values = rawValues.map((rawValue, j) => {
      const entry = isObject(rawValue) ? rawValue : {};
      const value = text(entry.value);
      if (!value || value.length > LIMITS.optionValue) errors.add(`options.${i}.values.${j}`, "Escribe el valor.");
      return { id: typeof entry.id === "string" ? entry.id : undefined, value };
    });
    const unique = new Set(values.map((v) => v.value.toLowerCase()));
    if (unique.size !== values.length) errors.add(`options.${i}.values`, "Hay valores repetidos.");
    return { id: typeof option.id === "string" ? option.id : undefined, name: optionName, values };
  });
  if (new Set(options.map((o) => o.name.toLowerCase())).size !== options.length) errors.add("options", "Hay opciones repetidas.");

  // Campos extra
  const rawFields: unknown[] = Array.isArray(body.customFields) ? body.customFields : [];
  if (rawFields.length > LIMITS.customFields) errors.add("customFields", `Máximo ${LIMITS.customFields} campos extra.`);
  const customFields = rawFields.map((raw, i) => {
    const field = isObject(raw) ? raw : {};
    const label = text(field.label);
    if (!label || label.length > LIMITS.fieldLabel) errors.add(`customFields.${i}.label`, "Escribe el nombre del campo.");
    const maxLength = field.maxLength ?? 60;
    if (!isInt(maxLength, 1, LIMITS.fieldMaxLength)) errors.add(`customFields.${i}.maxLength`, "Escribe un máximo de 1 a 200 letras.");
    return {
      id: typeof field.id === "string" ? field.id : undefined,
      label,
      required: field.required === true,
      maxLength: maxLength as number,
    };
  });
  if (new Set(customFields.map((f) => f.label.toLowerCase())).size !== customFields.length) {
    errors.add("customFields", "Hay campos repetidos.");
  }

  // Variantes: exactamente una por combinación
  const rawVariants: unknown[] = Array.isArray(body.variants) ? body.variants : [];
  const variants: ParsedVariant[] = rawVariants.map((raw, i) => {
    const variant = isObject(raw) ? raw : {};
    const values = Array.isArray(variant.optionValues) ? variant.optionValues.map(text) : [];
    if (!isInt(variant.priceCents, 0, LIMITS.priceCents)) errors.add(`variants.${i}.priceCents`, "Escribe un precio válido.");
    if (variant.lowStockThreshold !== null && variant.lowStockThreshold !== undefined && !isInt(variant.lowStockThreshold, 0, LIMITS.stock)) {
      errors.add(`variants.${i}.lowStockThreshold`, "Escribe un número válido.");
    }
    const initialStock = variant.initialStock ?? 0;
    if (!isInt(initialStock, 0, LIMITS.stock)) errors.add(`variants.${i}.initialStock`, "Escribe una cantidad válida.");
    return {
      id: typeof variant.id === "string" ? variant.id : undefined,
      values,
      priceCents: variant.priceCents as number,
      active: variant.active !== false,
      lowStockThreshold: (variant.lowStockThreshold ?? null) as number | null,
      initialStock: initialStock as number,
    };
  });

  const expected = combinations(options.map((o) => ({ name: o.name, values: o.values.map((v) => v.value) })));
  const key = (values: string[]) => values.map((v) => v.toLowerCase()).join("\u0000");
  const expectedKeys = new Set(expected.map(key));
  const givenKeys = variants.map((v) => key(v.values));
  if (
    variants.length !== expected.length ||
    new Set(givenKeys).size !== givenKeys.length ||
    givenKeys.some((k) => !expectedKeys.has(k))
  ) {
    errors.add("variants", "Debe haber exactamente una variante por cada combinación de opciones.");
  }

  errors.throwIfAny("Revisa los datos del producto.");
  return { categoryId, name, description, images, madeToOrder, sizeGuideUrl, visible, options, variants, customFields };
}

/** Guarda opciones, campos extra y variantes conservando los ids que ya existen. */
function applyProduct(
  db: MockDb,
  store: StoreRecord,
  product: ProductRecord,
  parsed: ParsedProduct,
  actor: string,
  now: Date,
) {
  // Opciones y valores: se conservan por id o por nombre
  const options: ProductOption[] = parsed.options.map((option) => {
    const existing =
      product.options.find((o) => o.id === option.id) ?? product.options.find((o) => sameText(o.name, option.name));
    return {
      id: existing?.id ?? `op_${crypto.randomUUID()}`,
      name: option.name,
      values: option.values.map((value) => {
        const found =
          existing?.values.find((v) => v.id === value.id) ?? existing?.values.find((v) => sameText(v.value, value.value));
        return { id: found?.id ?? `ov_${crypto.randomUUID()}`, value: value.value };
      }),
    };
  });

  const customFields = parsed.customFields.map((field) => {
    const existing =
      product.customFields.find((f) => f.id === field.id) ?? product.customFields.find((f) => sameText(f.label, field.label));
    return { id: existing?.id ?? `cf_${crypto.randomUUID()}`, label: field.label, required: field.required, maxLength: field.maxLength };
  });

  // Variantes: se conservan por id o por combinación de valores
  const existingVariants = db.variants.filter((v) => v.productId === product.id);
  const valueIdsFor = (values: string[]) =>
    values.map((value, i) => options[i]!.values.find((v) => sameText(v.value, value))!.id);

  const used = new Set<string>();
  const matched = parsed.variants.map((variant) => {
    const optionValueIds = valueIdsFor(variant.values);
    const free = existingVariants.filter((v) => !used.has(v.id));
    const existing =
      free.find((v) => v.id === variant.id) ?? free.find((v) => v.optionValueIds.join() === optionValueIds.join());
    if (existing) used.add(existing.id);
    return { variant, optionValueIds, existing };
  });

  // Quitar variantes con unidades reservadas dejaría pedidos sin stock: se rechaza
  const keptIds = new Set(matched.map((m) => m.existing?.id).filter(Boolean));
  const removed = existingVariants.filter((v) => !keptIds.has(v.id));
  for (const variant of removed) {
    const reserved = db.stockItems.find((s) => s.variantId === variant.id)?.reserved ?? 0;
    if (reserved > 0) {
      throw conflict(
        "variant_reserved",
        `No puedes quitar "${variant.label || product.name}": tiene ${reserved} reservados en pedidos nuevos.`,
      );
    }
  }

  Object.assign(product, {
    categoryId: parsed.categoryId,
    name: parsed.name,
    description: parsed.description,
    images: parsed.images,
    madeToOrder: parsed.madeToOrder,
    sizeGuideUrl: parsed.sizeGuideUrl,
    visible: parsed.visible,
    options,
    customFields,
  });

  const removedIds = new Set(removed.map((v) => v.id));
  db.variants = db.variants.filter((v) => !removedIds.has(v.id));
  db.stockItems = db.stockItems.filter((s) => !removedIds.has(s.variantId));

  matched.forEach(({ variant, optionValueIds, existing }, position) => {
    const label = variant.values.join(" / ");
    if (existing) {
      Object.assign(existing, { optionValueIds, label, priceCents: variant.priceCents, active: variant.active, position });
      const stock = db.stockItems.find((s) => s.variantId === existing.id)!;
      stock.lowStockThreshold = variant.lowStockThreshold;
      return;
    }
    const record: VariantRecord = {
      id: `va_${crypto.randomUUID()}`,
      productId: product.id,
      storeId: store.id,
      optionValueIds,
      label,
      priceCents: variant.priceCents,
      active: variant.active,
      position,
    };
    db.variants.push(record);
    db.stockItems.push({
      variantId: record.id,
      storeId: store.id,
      onHand: 0,
      reserved: 0,
      lowStockThreshold: variant.lowStockThreshold,
    });
    // El stock inicial queda en el historial como un ingreso
    if (variant.initialStock > 0 && !parsed.madeToOrder) {
      recordStockMovement(db, {
        variantId: record.id,
        type: "in",
        amount: variant.initialStock,
        reason: "stock_inicial",
        createdBy: actor,
        now,
      });
    }
  });
}

/** POST /me/products */
export function createProduct(db: MockDb, store: StoreRecord, input: unknown, now: Date = new Date()): ProductAdmin {
  const limit = getLimit(store, "maxProducts", now);
  const count = db.products.filter((p) => p.storeId === store.id).length;
  if (limit !== null && count >= limit) {
    throw new MockApiError(403, "plan_limit", `Tu plan permite hasta ${limit} productos. Mejora a Pro para agregar más.`);
  }

  const parsed = parseProduct(db, store, input);
  const product: ProductRecord = {
    id: `pr_${crypto.randomUUID()}`,
    storeId: store.id,
    categoryId: null,
    name: "",
    description: "",
    images: [],
    madeToOrder: false,
    sizeGuideUrl: null,
    visible: true,
    position: Math.max(-1, ...db.products.filter((p) => p.storeId === store.id).map((p) => p.position)) + 1,
    options: [],
    customFields: [],
  };
  db.products.push(product);
  applyProduct(db, store, product, parsed, store.ownerName, now);
  return toProductAdmin(db, product, store);
}

/** PUT /me/products/:id — reemplaza el producto. El stock de variantes existentes no cambia aquí. */
export function updateProduct(
  db: MockDb,
  store: StoreRecord,
  productId: string,
  input: unknown,
  now: Date = new Date(),
): ProductAdmin {
  const product = findOwnProduct(db, store, productId);
  const parsed = parseProduct(db, store, input);
  applyProduct(db, store, product, parsed, store.ownerName, now);
  return toProductAdmin(db, product, store);
}

/** PATCH /me/products/:id — mostrar u ocultar en la tienda. */
export function setProductVisible(db: MockDb, store: StoreRecord, productId: string, input: unknown): ProductAdmin {
  const product = findOwnProduct(db, store, productId);
  if (!isObject(input) || typeof input.visible !== "boolean") {
    throw badRequest("Indica si el producto es visible.", { fields: { visible: "Debe ser sí o no." } });
  }
  product.visible = input.visible;
  return toProductAdmin(db, product, store);
}
