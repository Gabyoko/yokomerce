"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { formatSoles } from "@/shared/lib/money";
import type { Product } from "@/shared/types";
import { Badge, Button, Input, useToast } from "@/shared/ui";

import { useCart } from "@/features/cart";

import { findVariant, initialSelection, maxQuantity, priceLabel, selectValue, type Selection } from "../lib/product";
import { OptionSelector } from "./OptionSelector";
import { QuantityStepper } from "./QuantityStepper";
import { SizeGuideButton } from "./SizeGuideButton";

type ProductPurchaseProps = {
  slug: string;
  product: Product;
  /** "Pídelo con 1 día de anticipación." o null. */
  notice: string | null;
};

/** Precio, opciones, campos extra, cantidad y "Agregar · S/ total" (design/Producto.dc.html). */
export function ProductPurchase({ slug, product, notice }: ProductPurchaseProps) {
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { add } = useCart(slug);
  const { toast } = useToast();

  const variant = findVariant(product, selection);
  const available = variant && variant.active ? maxQuantity(product, variant) : 0;
  const soldOut = variant !== undefined && available === 0;
  const qty = Math.min(quantity, Math.max(available, 1));

  function select(optionIndex: number, valueId: string) {
    setSelection((current) => selectValue(product, current, optionIndex, valueId));
    setQuantity(1);
  }

  function addToCart() {
    if (!variant) return;
    const missing: Record<string, string> = {};
    for (const field of product.customFields) {
      if (field.required && !values[field.id]?.trim()) missing[field.id] = `Completa "${field.label}".`;
    }
    setErrors(missing);
    if (Object.keys(missing).length > 0) {
      document.getElementById(`campo-${Object.keys(missing)[0]}`)?.focus();
      return;
    }

    // En el carrito los campos extra se guardan por su etiqueta, como los recibe la API
    const customValues = Object.fromEntries(
      product.customFields.map((f) => [f.label, values[f.id]?.trim() ?? ""] as const).filter(([, value]) => value),
    );
    add({ variantId: variant.id, quantity: qty, customValues });
    toast({
      title: `Agregaste ${qty} × ${product.name}${variant.label ? ` (${variant.label})` : ""}`,
      tone: "success",
    });
  }

  const buttonLabel = !variant ? "Elige una opción" : soldOut ? "Agotado" : `Agregar · ${formatSoles(variant.priceCents * qty)}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[22px] font-bold">{variant ? formatSoles(variant.priceCents) : priceLabel(product)}</p>
        {variant && !product.madeToOrder && variant.lowStock && variant.available > 0 && (
          <Badge tone="warning">{variant.available === 1 ? "Queda 1" : `Quedan ${variant.available}`}</Badge>
        )}
        {product.madeToOrder && <Badge tone="dark">Por encargo</Badge>}
      </div>

      {product.description && <p className="-mt-3 text-[15px] leading-relaxed text-ink-muted">{product.description}</p>}

      {product.options.length > 0 && <OptionSelector product={product} selection={selection} onSelect={select} />}

      {product.sizeGuideUrl && <SizeGuideButton url={product.sizeGuideUrl} productName={product.name} />}

      {product.customFields.map((field) => (
        <Input
          key={field.id}
          id={`campo-${field.id}`}
          label={field.label}
          optional={!field.required}
          maxLength={field.maxLength}
          value={values[field.id] ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            setValues((current) => ({ ...current, [field.id]: value }));
            if (errors[field.id]) setErrors((current) => ({ ...current, [field.id]: "" }));
          }}
          hint={`${(values[field.id] ?? "").length} de ${field.maxLength} letras.`}
          error={errors[field.id] || undefined}
        />
      ))}

      {notice && (
        <div className="flex items-center gap-2.5 rounded-control border border-border bg-surface px-3.5 py-3 text-sm">
          <Clock aria-hidden size={18} className="shrink-0 text-primary" />
          {notice}
        </div>
      )}

      {/* Celular: barra fija abajo. Computadora: al final de la columna. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-surface px-4 pt-3.5 pb-[max(1.375rem,env(safe-area-inset-bottom))] lg:static lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0">
        <QuantityStepper value={qty} max={Math.max(available, 1)} onChange={setQuantity} disabled={!variant || soldOut} />
        <Button size="lg" fullWidth className="shrink" disabled={!variant || soldOut} onClick={addToCart}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
