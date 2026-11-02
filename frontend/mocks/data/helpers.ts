import type { SeedVariant } from "./types";

type Options = { name: string; values: string[] }[];

/** Todas las combinaciones de valores: [[Negro, S], [Negro, M], ...]. */
export function combinations(options: Options): string[][] {
  return options.reduce<string[][]>(
    (acc, option) => acc.flatMap((prefix) => option.values.map((value) => [...prefix, value])),
    [[]],
  );
}

/**
 * Una variante por combinación con el mismo precio.
 * `available` y `overrides` se indexan por la etiqueta "Negro / S".
 */
export function variantGrid(
  options: Options,
  priceCents: number,
  defaults: { available: number; lowStockThreshold?: number | null },
  overrides: Record<string, Partial<Omit<SeedVariant, "values">>> = {},
): SeedVariant[] {
  return combinations(options).map((values) => ({
    values,
    priceCents,
    ...defaults,
    ...overrides[values.join(" / ")],
  }));
}
