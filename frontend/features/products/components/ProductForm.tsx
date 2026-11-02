"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";

import { ApiError } from "@/shared/api/client";
import type { Category, ProductAdmin, StoreFeatures } from "@/shared/types";
import { Button, buttonStyles, Card, Input, Switch, Textarea, useToast } from "@/shared/ui";

import { createProduct, updateProduct } from "../api";
import { shouldShowOptionsHelp } from "../lib/onboarding";
import {
  emptyProductDraft,
  PRODUCT_LIMITS,
  type ProductDraft,
  type ProductErrors,
  setDefaults,
  toProductDraft,
  toProductInput,
  validateProduct,
} from "../lib/product-form";
import { CategoryPicker } from "./CategoryPicker";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { ImagePicker } from "./ImagePicker";
import { OptionsEditor } from "./OptionsEditor";
import { ProductImagesField } from "./ProductImagesField";
import { VariantsEditor } from "./VariantsEditor";

type ProductFormProps = {
  /** Sin producto = crear uno nuevo. */
  product?: ProductAdmin;
  categories: Category[];
  features: Pick<StoreFeatures, "madeToOrder" | "sizeGuide">;
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function focusFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('[data-product-form] [aria-invalid="true"], [data-product-form] [data-error]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target?.matches("input, select, textarea")) target.focus({ preventScroll: true });
  });
}

const noopSubscribe = () => () => {};

/** Crear y editar producto: fotos, datos, opciones, combinaciones, campos extra y visibilidad. */
export function ProductForm({ product, categories: initialCategories, features }: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ProductDraft>(() => (product ? toProductDraft(product) : emptyProductDraft()));
  const [savedDraft, setSavedDraft] = useState(draft);
  const [categories, setCategories] = useState(initialCategories);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [saving, setSaving] = useState(false);
  // La ayuda de opciones depende de lo que se respondió en el registro (guardado en el navegador)
  const showHelp = useSyncExternalStore(noopSubscribe, shouldShowOptionsHelp, () => false);

  const isNew = !product;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const hasOptions = draft.options.length > 0;
  const single = draft.variants.length === 1 && draft.variants[0]!.values.length === 0 ? draft.variants[0]! : null;
  const tracksStock = !draft.madeToOrder;

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    const found = validateProduct(draft, features);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ tone: "error", title: "Revisa los campos marcados" });
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      const input = toProductInput(draft);
      if (isNew) {
        const created = await createProduct(input);
        setSavedDraft(draft);
        toast({ tone: "success", title: `Creamos "${created.name}"` });
        router.push("/panel/productos");
        router.refresh();
        return;
      }
      const updated = await updateProduct(product.id, input);
      const next = toProductDraft(updated);
      setDraft(next);
      setSavedDraft(next);
      toast({ tone: "success", title: "Guardamos los cambios" });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.body.fields;
        if (error.code === "validation" && typeof fields === "object" && fields !== null) {
          setErrors(fields as ProductErrors);
          focusFirstError();
        }
        toast({ tone: "error", title: "No pudimos guardar el producto", description: error.message });
      } else {
        toast({ tone: "error", title: "No pudimos guardar el producto", description: "Revisa tu conexión e inténtalo otra vez." });
      }
    }
    setSaving(false);
  }

  return (
    <div data-product-form className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/panel/productos"
          aria-label="Volver a productos"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft aria-hidden size={20} />
        </Link>
        <h1 className="min-w-0 truncate font-display text-2xl font-bold tracking-tight lg:text-3xl">
          {isNew ? "Nuevo producto" : product.name}
        </h1>
      </div>

      <Section title="Fotos">
        <ProductImagesField images={draft.images} onChange={(images) => set("images", images)} error={errors.images} />
      </Section>

      <Section title="Información">
        <Input
          label="Nombre"
          placeholder="Ej. Polo oversize"
          maxLength={PRODUCT_LIMITS.name}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <Textarea
          label="Descripción"
          optional
          rows={4}
          maxLength={PRODUCT_LIMITS.description}
          placeholder="Material, medidas, sabor, lo que ayude a decidir"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          error={errors.description}
        />
        <CategoryPicker
          categories={categories}
          value={draft.categoryId}
          onChange={(categoryId) => set("categoryId", categoryId)}
          onCategoriesChange={setCategories}
          error={errors.categoryId}
        />
      </Section>

      <Section title="Precio y stock">
        {features.madeToOrder && (
          <Switch
            label="Por encargo"
            description="Lo preparas cuando te lo piden: no controla stock y nunca aparece agotado."
            checked={draft.madeToOrder}
            onCheckedChange={(on) => set("madeToOrder", on)}
          />
        )}
        {errors.madeToOrder && (
          <p data-error className="text-[13px] font-medium text-danger">
            {errors.madeToOrder}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label={hasOptions ? "Precio base (S/)" : "Precio (S/)"}
            inputMode="decimal"
            placeholder="45"
            hint={hasOptions ? "Se usa en las combinaciones nuevas." : undefined}
            value={single ? single.price : draft.price}
            onChange={(e) => setDraft((d) => setDefaults(d, { price: e.target.value }))}
            error={single ? errors["variants.0.priceCents"] : undefined}
          />
          {tracksStock &&
            (single?.id && single.current ? (
              <div className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">Stock</span>
                <p className="flex h-12 items-center text-[15px]">
                  <span className="font-bold">{single.current.onHand - single.current.reserved}</span>
                  <span className="ml-1 text-ink-muted">
                    disponibles{single.current.reserved > 0 ? ` · ${single.current.reserved} reservados` : ""}
                  </span>
                </p>
              </div>
            ) : (
              <Input
                label={hasOptions ? "Stock inicial base" : "Stock inicial"}
                inputMode="numeric"
                placeholder="0"
                hint={hasOptions ? "Se usa en las combinaciones nuevas." : "Cuántos tienes ahora."}
                value={single ? single.stock : draft.stock}
                onChange={(e) => setDraft((d) => setDefaults(d, { stock: e.target.value }))}
                error={single ? errors["variants.0.initialStock"] : undefined}
              />
            ))}
          {tracksStock && (
            <Input
              label="Avisarme cuando queden"
              optional
              inputMode="numeric"
              placeholder="Ej. 3"
              hint="Te mostramos una alerta de stock bajo."
              value={draft.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", e.target.value)}
              error={errors.lowStockThreshold}
            />
          )}
        </div>
        {tracksStock && single?.id && (
          <p className="text-[13px] text-ink-muted">El stock se cambia con un ajuste de stock, para que quede en el historial.</p>
        )}
      </Section>

      <Section title="Opciones" description="Talla, color, tamaño, sabor… Hasta 3 por producto.">
        <OptionsEditor draft={draft} errors={errors} onChange={setDraft} showHelp={showHelp} />
      </Section>

      {hasOptions && draft.variants.length > 0 && draft.variants[0]!.values.length > 0 && (
        <Section title={`Combinaciones (${draft.variants.length})`} description="Cada combinación tiene su precio y su stock.">
          <VariantsEditor draft={draft} errors={errors} onChange={setDraft} />
        </Section>
      )}

      <Section title="Campos extra" description="Texto que el cliente escribe al pedir, como una dedicatoria o un nombre para personalizar.">
        <CustomFieldsEditor draft={draft} errors={errors} onChange={setDraft} />
      </Section>

      {(features.sizeGuide || draft.sizeGuideUrl) && (
        <Section title="Guía de tallas" description="Una imagen con las medidas. Se abre desde el producto.">
          <ImagePicker
            label="Imagen de la guía"
            shape="wide"
            value={draft.sizeGuideUrl}
            onChange={(url) => set("sizeGuideUrl", url)}
          />
          {errors.sizeGuideUrl && (
            <p data-error className="text-[13px] font-medium text-danger">
              {errors.sizeGuideUrl}
            </p>
          )}
        </Section>
      )}

      <Card padding="lg">
        <Switch
          label="Visible en tu tienda"
          description={draft.visible ? "Tus clientes lo ven en el catálogo." : "Oculto: solo tú lo ves aquí."}
          checked={draft.visible}
          onCheckedChange={(visible) => set("visible", visible)}
        />
      </Card>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3 shadow-lg lg:bottom-4">
        <p className="pl-1 text-sm font-semibold">{dirty ? "Tienes cambios sin guardar" : isNew ? "Completa los datos" : "Todo guardado"}</p>
        <div className="flex gap-2">
          <Link href="/panel/productos" className={buttonStyles({ variant: "ghost" })}>
            {dirty ? "Cancelar" : "Volver"}
          </Link>
          <Button onClick={save} loading={saving} disabled={!isNew && !dirty}>
            {isNew ? "Crear producto" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
