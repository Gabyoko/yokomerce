import { Card, Skeleton } from "@/shared/ui";

/** Mientras carga el catálogo: portada, nombre, buscador y tarjetas. */
export function CatalogSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando la tienda" className="flex flex-col gap-4">
      <Skeleton className="h-28 w-full rounded-none sm:h-40 lg:rounded-card" />
      <div className="-mt-12 flex flex-col gap-3 px-4 sm:px-6">
        <Skeleton className="size-18 rounded-[20px] border-4 border-bg" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-0">
        <Skeleton className="h-12 w-full rounded-control" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:px-0 xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, n) => (
          <Card key={n} padding="sm" className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="mx-1 h-4 w-3/4" />
            <Skeleton className="mx-1 h-3 w-1/2" />
            <div className="flex items-center justify-between px-1 pb-1">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="size-11 rounded-control" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Mientras carga un producto: foto, título, precio y opciones. */
export function ProductSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el producto" className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-10">
      <Skeleton className="h-80 w-full rounded-none lg:aspect-square lg:h-auto lg:rounded-card" />
      <div className="flex flex-col gap-4 px-5 pt-6 lg:px-0 lg:pt-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-16 w-full rounded-[16px]" />
        <Skeleton className="h-16 w-full rounded-[16px]" />
      </div>
    </div>
  );
}
