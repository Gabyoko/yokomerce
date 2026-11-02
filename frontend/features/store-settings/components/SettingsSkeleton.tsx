import { Card, Skeleton } from "@/shared/ui";

/** Mientras carga la configuración. */
export function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando la configuración" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full rounded-card" />
      {[0, 1].map((n) => (
        <Card key={n} padding="lg" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
