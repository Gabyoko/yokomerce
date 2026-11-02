import type { ReactNode } from "react";

import { Card, Skeleton } from "@/shared/ui";

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-2 lg:px-0 lg:pt-0">
      <Skeleton className="size-11 rounded-full" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-3.5 w-44" />
      </div>
    </div>
  );
}

function Columns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 px-5 lg:flex-row lg:gap-8 lg:px-0">
      <div className="flex min-w-0 flex-1 flex-col gap-4">{main}</div>
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80 xl:w-96">{aside}</div>
    </div>
  );
}

/** Mientras se lee el carrito: líneas, formas de entrega y subtotal. */
export function CartReviewSkeleton({ header }: { header?: ReactNode }) {
  return (
    <div aria-busy="true" aria-label="Cargando tu carrito" className="flex flex-col gap-3 lg:gap-6">
      {header ?? <HeaderSkeleton />}
      <Columns
        main={
          <Card padding="none" className="divide-y divide-border">
            {[0, 1].map((n) => (
              <div key={n} className="flex gap-3 p-3.5">
                <Skeleton className="size-16 rounded-control" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-11 w-28" />
                </div>
              </div>
            ))}
          </Card>
        }
        aside={
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-16 rounded-[16px]" />
              <Skeleton className="h-16 rounded-[16px]" />
            </div>
            <Skeleton className="h-24 rounded-card" />
          </>
        }
      />
    </div>
  );
}

/** Mientras carga el checkout: formulario y resumen. */
export function CheckoutSkeleton({ header }: { header?: ReactNode }) {
  return (
    <div aria-busy="true" aria-label="Cargando el formulario" className="flex flex-col gap-3 lg:gap-6">
      {header ?? <HeaderSkeleton />}
      <Columns
        main={
          <>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mt-4 h-5 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        }
        aside={<Skeleton className="h-48 rounded-card" />}
      />
    </div>
  );
}

/** Mientras carga la página del pedido. */
export function OrderReadySkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tu pedido" className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 px-5 pt-10">
      <Skeleton className="size-18 rounded-full" />
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-4 h-64 w-full rounded-[20px]" />
      <Skeleton className="h-14 w-full rounded-[16px]" />
    </div>
  );
}
