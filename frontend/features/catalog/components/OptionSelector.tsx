"use client";

import { formatSoles } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import type { Product } from "@/shared/types";
import { Badge } from "@/shared/ui";

import { findVariant, isValueSelectable, type Selection } from "../lib/product";

type OptionSelectorProps = {
  product: Product;
  selection: Selection;
  onSelect: (optionIndex: number, valueId: string) => void;
};

/**
 * Una fila por opción. Los valores sin stock con lo ya elegido aparecen tachados.
 * Un valor tachado que existe con otra combinación se puede tocar: cambia las demás opciones.
 * Con una sola opción se muestra como lista con precio y stock (design/Producto.dc.html).
 */
export function OptionSelector({ product, selection, onSelect }: OptionSelectorProps) {
  const nothingSelected = product.options.map(() => null);
  const single = product.options.length === 1;

  return (
    <div className="flex flex-col gap-5">
      {product.options.map((option, optionIndex) => {
        const chosen = option.values.find((v) => v.id === selection[optionIndex]);
        return (
          <fieldset key={option.id} className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-base font-bold">
              {option.name}
              {!single && chosen && <span className="font-medium text-ink-muted">: {chosen.value}</span>}
            </legend>
            <div role="radiogroup" aria-label={option.name} className={single ? "flex flex-col gap-2.5" : "flex flex-wrap gap-2"}>
              {option.values.map((value) => {
                const checked = selection[optionIndex] === value.id;
                const exists = isValueSelectable(product, optionIndex, value.id, nothingSelected);
                const crossed = !isValueSelectable(product, optionIndex, value.id, selection);
                const label = crossed ? `${value.value}, agotado` : value.value;

                if (single) {
                  const variant = findVariant(product, [value.id]);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={label}
                      disabled={!exists}
                      onClick={() => onSelect(optionIndex, value.id)}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-[16px] px-4 text-left transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed",
                        checked ? "border-2 border-primary bg-primary-soft" : "border border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("size-5 shrink-0 rounded-full bg-white", checked ? "border-[6px] border-primary" : "border-2 border-border-strong")}
                      />
                      <span className={cn("flex-1 text-[15px] font-bold", crossed && "text-ink-muted line-through")}>{value.value}</span>
                      {variant && !product.madeToOrder && variant.active && variant.available > 0 && variant.lowStock && (
                        <Badge tone="warning">{variant.available === 1 ? "Queda 1" : `Quedan ${variant.available}`}</Badge>
                      )}
                      {crossed && <Badge tone="danger">Agotado</Badge>}
                      {variant && <span className="text-[15px] font-bold">{formatSoles(variant.priceCents, { trimZeroDecimals: true })}</span>}
                    </button>
                  );
                }

                return (
                  <button
                    key={value.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={label}
                    disabled={!exists}
                    onClick={() => onSelect(optionIndex, value.id)}
                    className={cn(
                      "h-11 min-w-11 cursor-pointer rounded-control px-4 text-sm font-semibold transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed",
                      checked
                        ? "border-2 border-primary bg-primary-soft text-ink"
                        : "border border-border bg-surface text-ink hover:border-border-strong",
                      crossed && "text-ink-muted line-through decoration-ink-muted",
                      !exists && "opacity-50",
                    )}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
