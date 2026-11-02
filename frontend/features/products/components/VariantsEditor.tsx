"use client";

import { useState } from "react";

import { cn } from "@/shared/lib/cn";
import { Button, fieldControlStyles, Input, Switch } from "@/shared/ui";

import { applyToAllVariants, type ProductDraft, type ProductErrors, variantLabel } from "../lib/product-form";

type VariantsEditorProps = {
  draft: ProductDraft;
  errors: ProductErrors;
  onChange: (draft: ProductDraft) => void;
};

/** Stock de una variante que ya existe: se cambia con ajustes, no aquí. */
function CurrentStock({ onHand, reserved }: { onHand: number; reserved: number }) {
  return (
    <span className="text-sm">
      <span className="font-semibold">{onHand - reserved}</span>
      <span className="text-ink-muted"> disp.</span>
      {reserved > 0 && <span className="block text-xs text-ink-muted">{reserved} reservados</span>}
    </span>
  );
}

/** Precio, stock y estado de cada combinación de opciones. */
export function VariantsEditor({ draft, errors, onChange }: VariantsEditorProps) {
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const tracksStock = !draft.madeToOrder;
  const hasNew = draft.variants.some((v) => !v.id);

  const setVariant = (index: number, change: Partial<ProductDraft["variants"][number]>) =>
    onChange({ ...draft, variants: draft.variants.map((v, i) => (i === index ? { ...v, ...change } : v)) });

  function applyAll() {
    onChange(
      applyToAllVariants(draft, {
        ...(bulkPrice.trim() ? { price: bulkPrice.trim() } : {}),
        ...(tracksStock && bulkStock.trim() ? { stock: bulkStock.trim() } : {}),
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 rounded-control bg-bg p-3">
        <Input
          label="Precio para todas (S/)"
          inputMode="decimal"
          placeholder="45"
          wrapperClassName="w-36"
          value={bulkPrice}
          onChange={(e) => setBulkPrice(e.target.value)}
        />
        {tracksStock && hasNew && (
          <Input
            label="Stock para las nuevas"
            inputMode="numeric"
            placeholder="0"
            wrapperClassName="w-36"
            value={bulkStock}
            onChange={(e) => setBulkStock(e.target.value)}
          />
        )}
        <Button variant="secondary" onClick={applyAll} disabled={!bulkPrice.trim() && !bulkStock.trim()}>
          Aplicar a todas
        </Button>
      </div>

      {errors.variants && (
        <p data-error className="text-[13px] font-medium text-danger">
          {errors.variants}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[13px] text-ink-muted">
              <th scope="col" className="pb-2 font-semibold">
                Combinación
              </th>
              <th scope="col" className="pb-2 font-semibold">
                Precio (S/)
              </th>
              {tracksStock && (
                <th scope="col" className="pb-2 font-semibold">
                  Stock
                </th>
              )}
              <th scope="col" className="pb-2 text-right font-semibold">
                Activa
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.variants.map((variant, index) => {
              const label = variantLabel(variant.values);
              const priceError = errors[`variants.${index}.priceCents`];
              const stockError = errors[`variants.${index}.initialStock`];
              return (
                <tr key={variant.key} className={cn(!variant.active && "opacity-60")}>
                  <th scope="row" className="border-t border-border py-2 pr-3 text-left font-semibold">
                    {label}
                    {!variant.id && <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] text-primary-hover">Nueva</span>}
                  </th>
                  <td className="border-t border-border py-2 pr-3 align-top">
                    <input
                      aria-label={`Precio de ${label}`}
                      inputMode="decimal"
                      value={variant.price}
                      onChange={(e) => setVariant(index, { price: e.target.value })}
                      aria-invalid={priceError ? true : undefined}
                      title={priceError}
                      className={cn(fieldControlStyles(Boolean(priceError)), "h-11 w-24 px-3")}
                    />
                  </td>
                  {tracksStock && (
                    <td className="border-t border-border py-2 pr-3 align-top">
                      {variant.id && variant.current ? (
                        <CurrentStock {...variant.current} />
                      ) : (
                        <input
                          aria-label={`Stock inicial de ${label}`}
                          inputMode="numeric"
                          value={variant.stock}
                          onChange={(e) => setVariant(index, { stock: e.target.value })}
                          aria-invalid={stockError ? true : undefined}
                          title={stockError}
                          className={cn(fieldControlStyles(Boolean(stockError)), "h-11 w-20 px-3")}
                        />
                      )}
                    </td>
                  )}
                  <td className="border-t border-border py-1 text-right">
                    <Switch
                      label={<span className="sr-only">{`${label} activa`}</span>}
                      checked={variant.active}
                      onCheckedChange={(active) => setVariant(index, { active })}
                      className="justify-end"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(errors).some((key) => /^variants\.\d+\./.test(key)) && (
        <p data-error className="text-[13px] font-medium text-danger">
          Revisa los precios y el stock marcados en rojo.
        </p>
      )}
      <p className="text-[13px] text-ink-muted">
        Las combinaciones inactivas no se muestran a tus clientes.
        {tracksStock && draft.variants.some((v) => v.id) && " El stock de las que ya existen se cambia con un ajuste de stock."}
      </p>
    </div>
  );
}
