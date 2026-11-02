"use client";

import { Lock, Package, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StockAdjustButton, StockPanel } from "@/features/inventory";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { formatSoles } from "@/shared/lib/money";
import type { Category, ProductAdmin, VariantAdmin } from "@/shared/types";
import { Badge, type BadgeTone, buttonStyles, Card, Input, Select, Switch, useToast } from "@/shared/ui";

import { setProductVisible } from "../api";
import {
  matchesFilter,
  PRODUCT_FILTERS,
  type ProductFilter,
  STOCK_STATUS_LABELS,
  type StockStatus,
  summarizeProduct,
} from "../lib/product-list";
import { CategoriesManager } from "./CategoriesManager";

type ProductListProps = {
  products: ProductAdmin[];
  categories: Category[];
  madeToOrderEnabled: boolean;
  /** Máximo de productos del plan; null = sin límite. */
  productLimit: number | null;
  /** El plan incluye el historial de movimientos de stock. */
  canSeeHistory: boolean;
  /** Filtro inicial (ej. "low" desde la alerta de stock bajo del panel de pedidos). */
  initialFilter?: ProductFilter;
};

const STATUS_TONES: Record<StockStatus, BadgeTone> = {
  available: "success",
  low: "warning",
  out: "danger",
  madeToOrder: "dark",
};

function Thumb({ product }: { product: ProductAdmin }) {
  const src = product.images[0];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-14 shrink-0 rounded-control bg-primary-soft object-cover" />
  ) : (
    <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
      <Package size={22} />
    </span>
  );
}

/** Estado de una combinación en la tabla de inventario. */
function variantStatus(variant: VariantAdmin, madeToOrder: boolean): StockStatus {
  if (madeToOrder) return "madeToOrder";
  const available = variant.onHand - variant.reserved;
  if (available <= 0) return "out";
  return variant.lowStock ? "low" : "available";
}

/** Productos e inventario: buscar, filtrar por estado y categoría, mostrar u ocultar. */
export function ProductList({ products, categories, madeToOrderEnabled, productLimit, canSeeHistory, initialFilter = "all" }: ProductListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>(initialFilter);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ productId: string; variantId: string } | null>(null);
  const selectedProduct = selected ? products.find((p) => p.id === selected.productId) : undefined;
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === selected?.variantId);

  const rows = products.map((product) => ({ product, summary: summarizeProduct(product, madeToOrderEnabled) }));
  const counts = Object.fromEntries(
    PRODUCT_FILTERS.map(({ id }) => [id, rows.filter((r) => matchesFilter(r.product, r.summary, { filter: id, search: "", categoryId: null })).length]),
  ) as Record<ProductFilter, number>;
  const visibleRows = rows.filter((r) => matchesFilter(r.product, r.summary, { filter, search, categoryId }));
  const attention = counts.low + counts.out;
  const atLimit = productLimit !== null && products.length >= productLimit;
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  async function toggleVisible(product: ProductAdmin, visible: boolean) {
    setPending(product.id);
    try {
      await setProductVisible(product.id, visible);
      toast({ tone: "success", title: visible ? `"${product.name}" ya se ve en tu tienda` : `Ocultamos "${product.name}"` });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "No pudimos cambiarlo", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setPending(null);
    }
  }

  const newButton = atLimit ? (
    <Link href="/panel/plan" className={buttonStyles({ variant: "secondary" })}>
      <Lock aria-hidden />
      Límite de {productLimit} productos
    </Link>
  ) : (
    <Link href="/panel/productos/nuevo" className={buttonStyles()}>
      <Plus aria-hidden />
      Nuevo producto
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">Productos e inventario</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            {products.length === 1 ? "1 producto" : `${products.length} productos`}
            {productLimit !== null && ` de ${productLimit}`}
            {attention > 0 && ` · ${attention} ${attention === 1 ? "necesita" : "necesitan"} atención`}
          </p>
        </div>
        <div className="flex gap-2">
          <CategoriesManager categories={categories} />
          {newButton}
        </div>
      </div>

      {products.length === 0 ? (
        <Card padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Package aria-hidden size={28} />
          </span>
          <h2 className="font-display text-xl font-bold">Aún no tienes productos</h2>
          <p className="max-w-sm text-[15px] text-ink-muted">Sube tu primer producto con su foto y su precio. Luego comparte el link de tu tienda.</p>
          <Link href="/panel/productos/nuevo" className={buttonStyles({ size: "lg", className: "mt-2" })}>
            <Plus aria-hidden />
            Subir mi primer producto
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              label="Buscar productos"
              hideLabel
              type="search"
              placeholder="Buscar productos"
              icon={<Search />}
              wrapperClassName="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {categories.length > 0 && (
              <Select
                label="Categoría"
                wrapperClassName="sm:w-56 [&>label]:sr-only gap-0"
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por estado">
            {PRODUCT_FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  filter === f.id ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink hover:border-border-strong",
                )}
              >
                {f.label} · {counts[f.id]}
              </button>
            ))}
          </div>

          {visibleRows.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">No hay productos con ese filtro.</p>
          ) : (
            <>
              {/* Celular: tarjetas */}
              <ul className="flex flex-col gap-2.5 lg:hidden">
                {visibleRows.map(({ product, summary }) => (
                  <li key={product.id}>
                    <Card padding="none" className="flex flex-wrap items-center gap-3 p-3">
                      <Link href={`/panel/productos/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-primary">
                        <Thumb product={product} />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-[15px] font-bold">{product.name}</span>
                          <span className="text-[13px] text-ink-muted">
                            {summary.priceLabel}
                            {summary.variantsLabel && ` · ${summary.variantsLabel}`}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                            <Badge tone={STATUS_TONES[summary.status]}>{STOCK_STATUS_LABELS[summary.status]}</Badge>
                            {summary.available !== null && <span className="text-ink-muted">{summary.available} disp.</span>}
                          </span>
                        </span>
                      </Link>
                      <Switch
                        label={<span className="sr-only">Visible: {product.name}</span>}
                        checked={product.visible}
                        disabled={pending === product.id}
                        onCheckedChange={(visible) => toggleVisible(product, visible)}
                      />
                      {summary.status !== "madeToOrder" && (
                        <StockAdjustButton product={product} canSeeHistory={canSeeHistory} label={summary.status === "available" ? "Ajustar stock" : "Reponer"} className="w-full" />
                      )}
                    </Card>
                  </li>
                ))}
              </ul>

              {/* Computadora: inventario por combinación con panel lateral */}
              <div className={cn("hidden gap-5 lg:grid", selected ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "")}>
                <Card padding="none" className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg text-left text-[13px] text-ink-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Producto</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Precio</th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">En total</th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">Reservado</th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">Disponible</th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">Mínimo</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Estado</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">Visible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleRows.flatMap(({ product, summary }) =>
                        product.variants.map((variant, index) => {
                          const madeToOrder = summary.status === "madeToOrder";
                          const status = variantStatus(variant, madeToOrder);
                          const isSelected = selected?.variantId === variant.id;
                          const dash = <span className="text-ink-muted">—</span>;
                          const select = () => !madeToOrder && setSelected({ productId: product.id, variantId: variant.id });
                          return (
                            <tr
                              key={variant.id}
                              className={cn(
                                !madeToOrder && "cursor-pointer hover:bg-bg/60",
                                isSelected && "bg-primary-soft/60 hover:bg-primary-soft/60",
                                (!product.visible || !variant.active) && "text-ink-muted",
                              )}
                              onClick={select}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                  {index === 0 ? <Thumb product={product} /> : <span aria-hidden className="w-14 shrink-0" />}
                                  <span className="min-w-0">
                                    {madeToOrder ? (
                                      <Link
                                        href={`/panel/productos/${product.id}`}
                                        className="block font-bold text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                                      >
                                        {product.name}
                                      </Link>
                                    ) : (
                                      <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        aria-label={`Ver stock de ${variant.label ? `${product.name} · ${variant.label}` : product.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          select();
                                        }}
                                        className="block cursor-pointer text-left font-bold text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                                      >
                                        {product.name}
                                      </button>
                                    )}
                                    <span className="block text-[13px] text-ink-muted">
                                      {[variant.label, categoryName(product.categoryId), variant.active ? "" : "inactiva"].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">{formatSoles(variant.priceCents)}</td>
                              <td className="px-3 py-2.5 text-right">{madeToOrder ? dash : variant.onHand}</td>
                              <td className="px-3 py-2.5 text-right">{madeToOrder ? dash : variant.reserved}</td>
                              <td className="px-3 py-2.5 text-right font-bold">{madeToOrder ? dash : Math.max(variant.onHand - variant.reserved, 0)}</td>
                              <td className="px-3 py-2.5 text-right">{madeToOrder || variant.lowStockThreshold === null ? dash : variant.lowStockThreshold}</td>
                              <td className="px-3 py-2.5">
                                <Badge tone={STATUS_TONES[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                              </td>
                              <td className="px-4 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                                {index === 0 && (
                                  <Switch
                                    label={<span className="sr-only">Visible: {product.name}</span>}
                                    checked={product.visible}
                                    disabled={pending === product.id}
                                    onCheckedChange={(visible) => toggleVisible(product, visible)}
                                    className="justify-end"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </Card>
                {selectedProduct && selectedVariant && (
                  <aside className="sticky top-6 self-start">
                    <StockPanel
                      key={selectedVariant.id}
                      product={selectedProduct}
                      variant={selectedVariant}
                      canSeeHistory={canSeeHistory}
                      onClose={() => setSelected(null)}
                    />
                  </aside>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
