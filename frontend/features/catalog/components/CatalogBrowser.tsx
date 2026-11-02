"use client";

import { PackageOpen, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/shared/lib/cn";
import type { Category, Product } from "@/shared/types";
import { Button, Input } from "@/shared/ui";

import { useCart } from "@/features/cart";

import { ProductCard } from "./ProductCard";

/** Minúsculas y sin tildes: "torta" encuentra "Tórta". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Section = { id: string; title: string; products: Product[] };

const ALL = "todo";

/** Buscador, categorías y grilla de productos. El filtrado es en el navegador, sin llamar a la API. */
export function CatalogBrowser({ slug, categories, products }: { slug: string; categories: Category[]; products: Product[] }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const { items } = useCart(slug);

  const inCart = useMemo(() => {
    const ids = new Set(items.map((i) => i.variantId));
    return new Set(products.filter((p) => p.variants.some((v) => ids.has(v.id))).map((p) => p.id));
  }, [items, products]);

  // Solo categorías con productos
  const usedCategories = categories.filter((c) => products.some((p) => p.categoryId === c.id));

  const sections: Section[] = useMemo(() => {
    const search = normalize(query.trim());
    if (search) {
      const found = products.filter((p) => normalize(`${p.name} ${p.description}`).includes(search));
      return [{ id: "search", title: `Resultados para “${query.trim()}”`, products: found }];
    }
    if (categoryId !== ALL) {
      const category = categories.find((c) => c.id === categoryId);
      return [{ id: categoryId, title: category?.name ?? "", products: products.filter((p) => p.categoryId === categoryId) }];
    }
    const grouped: Section[] = usedCategories.map((c) => ({
      id: c.id,
      title: c.name,
      products: products.filter((p) => p.categoryId === c.id),
    }));
    const others = products.filter((p) => !usedCategories.some((c) => c.id === p.categoryId));
    if (others.length > 0) grouped.push({ id: "otros", title: usedCategories.length > 0 ? "Otros" : "Productos", products: others });
    return grouped;
  }, [query, categoryId, products, categories, usedCategories]);

  if (products.length === 0) {
    return (
      <div className="mx-4 flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong px-6 py-12 text-center sm:mx-6 lg:mx-0">
        <PackageOpen aria-hidden size={32} className="text-ink-muted" />
        <h2 className="text-lg font-bold">Todavía no hay productos</h2>
        <p className="text-sm text-ink-muted">Esta tienda está preparando su catálogo. Vuelve pronto.</p>
      </div>
    );
  }

  const noResults = sections.every((s) => s.products.length === 0);
  let rendered = 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 sm:px-6 lg:px-0">
        <Input
          label="Buscar productos"
          hideLabel
          type="search"
          icon={<Search />}
          placeholder="Buscar productos…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {usedCategories.length > 1 && !query.trim() && (
        <nav aria-label="Categorías" className="-my-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max gap-2 px-4 py-1 sm:px-6 lg:px-0">
            {[{ id: ALL, name: "Todo" }, ...usedCategories].map((c) => {
              const active = c.id === categoryId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "h-11 cursor-pointer rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      active ? "bg-ink text-white" : "border border-border bg-surface text-ink hover:border-border-strong",
                    )}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {noResults ? (
        <div className="mx-4 flex flex-col items-center gap-3 py-10 text-center sm:mx-6 lg:mx-0">
          <SearchX aria-hidden size={32} className="text-ink-muted" />
          <p className="text-ink-muted">No encontramos productos con “{query.trim()}”.</p>
          <Button variant="secondary" onClick={() => setQuery("")}>
            Ver todos los productos
          </Button>
        </div>
      ) : (
        sections
          .filter((s) => s.products.length > 0)
          .map((section) => (
            <section key={section.id} aria-labelledby={`seccion-${section.id}`} className="flex flex-col gap-3 px-4 pt-2 sm:px-6 lg:px-0">
              <h2 id={`seccion-${section.id}`} className="text-[19px] font-bold">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {section.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    slug={slug}
                    product={product}
                    inCart={inCart.has(product.id)}
                    // Las primeras fotos se ven sin desplazarse: se cargan de inmediato
                    priority={rendered++ < 4}
                  />
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
