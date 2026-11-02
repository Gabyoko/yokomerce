import { Card, Skeleton } from "@/shared/ui";

export function OrdersBoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando pedidos" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-12 w-full rounded-field" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((n) => (
        <Card key={n} padding="none" className="flex flex-col gap-2.5 p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-11 w-full rounded-control" />
        </Card>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el pedido" className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-6 w-full" />
      {[0, 1, 2].map((n) => (
        <Card key={n} padding="lg" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
