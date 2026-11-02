import { Card, Skeleton } from "@/shared/ui";

export function ProductListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando productos" className="flex flex-col gap-5">
      <div className="flex justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-11 w-40 rounded-control" />
      </div>
      <Skeleton className="h-12 w-full rounded-field" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }, (_, n) => (
          <Card key={n} padding="none" className="flex items-center gap-3 p-3">
            <Skeleton className="size-14 rounded-control" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProductFormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el producto" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Skeleton className="h-9 w-64" />
      {[0, 1, 2].map((n) => (
        <Card key={n} padding="lg" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
