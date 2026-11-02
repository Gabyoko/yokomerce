import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { loadCatalog, loadProduct, orderNotice, ProductGallery, ProductPurchase, ShareButton } from "@/features/catalog";

type Props = PageProps<"/[slug]/p/[productId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params;
  let data;
  try {
    data = await Promise.all([loadCatalog(slug), loadProduct(slug, productId)]);
  } catch {
    // Si no existe, la página muestra su propio not-found; los metadatos no deben adelantarse
    return {};
  }
  const [{ store }, product] = data;
  const title = `${product.name} · ${store.name}`;
  const description = product.description || `Pídelo a ${store.name} por WhatsApp.`;
  const image = product.images[0] ?? store.coverUrl ?? store.logoUrl;
  return { title, description, openGraph: { title, description, images: image ? [image] : undefined } };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productId } = await params;
  const [{ store }, product] = await Promise.all([loadCatalog(slug), loadProduct(slug, productId)]);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="relative h-80 sm:h-[28rem] lg:sticky lg:top-8 lg:aspect-square lg:h-auto lg:overflow-hidden lg:rounded-card">
        <ProductGallery images={product.images} name={product.name} />
        <Link
          href={`/${slug}`}
          aria-label={`Volver a ${store.name}`}
          className="absolute top-4 left-4 flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft aria-hidden size={20} />
        </Link>
        <ShareButton title={product.name} className="absolute top-4 right-4" />
      </div>

      <div className="relative -mt-5 flex flex-col gap-5 rounded-t-sheet bg-bg px-5 pt-6 pb-8 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-2">
        <div>
          <p className="mb-1 text-sm text-ink-muted">
            <Link href={`/${slug}`} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
              {store.name}
            </Link>
          </p>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight lg:text-3xl">{product.name}</h1>
        </div>
        <ProductPurchase slug={slug} product={product} notice={orderNotice(product, store.features)} />
      </div>
    </div>
  );
}
