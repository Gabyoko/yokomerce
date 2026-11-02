import { Card, Skeleton } from "@/shared/ui";

export function PlanSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tu plan" className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((n) => (
          <Card key={n} padding="lg" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}
