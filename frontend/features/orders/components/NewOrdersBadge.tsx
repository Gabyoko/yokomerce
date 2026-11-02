import { cn } from "@/shared/lib/cn";

import { loadMyOrders } from "../queries";

/** Cantidad de pedidos nuevos junto a "Pedidos" en el menú (va dentro de un Suspense). */
export async function NewOrdersBadge({ variant }: { variant: "sidebar" | "bottom" }) {
  const count = (await loadMyOrders()).filter((o) => o.status === "new").length;
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "rounded-full bg-primary font-bold text-white",
        variant === "sidebar" ? "px-2 py-0.5 text-xs" : "absolute top-0 right-2 flex size-5 items-center justify-center text-[11px]",
      )}
    >
      {count}
      <span className="sr-only"> nuevos</span>
    </span>
  );
}
