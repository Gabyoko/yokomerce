import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Bloque de carga. Dale tamaño con className: <Skeleton className="h-5 w-32" />.
 * Es decorativo: el contenedor que carga debe tener aria-busy="true".
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-field bg-border/70", className)} {...props} />;
}
