import { MapPin, Package, Store as StoreIcon, Truck } from "lucide-react";

import type { Catalog } from "@/shared/types";
import { Badge } from "@/shared/ui";

import { getDeliveryLabels, getOpenStatus, storeInitials } from "../lib/store-info";

const deliveryIcons: Record<string, typeof Truck> = {
  Delivery: MapPin,
  Recojo: StoreIcon,
  Envíos: Package,
};

/** Portada, logo, nombre y badges de horario y entrega (design/Main.dc.html). */
export function StoreHeader({ catalog }: { catalog: Catalog }) {
  const { store } = catalog;
  const status = getOpenStatus(store.businessHours);
  const deliveries = getDeliveryLabels(catalog);

  return (
    <header className="flex flex-col">
      {store.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.coverUrl} alt="" className="h-28 w-full object-cover sm:h-40 lg:rounded-card" />
      ) : (
        <div aria-hidden className="h-28 w-full bg-primary-soft sm:h-40 lg:rounded-card" />
      )}

      <div className="-mt-9 flex flex-col gap-3 px-4 sm:px-6 lg:px-6">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt="" className="size-18 rounded-[20px] border-4 border-bg object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-18 items-center justify-center rounded-[20px] border-4 border-bg bg-primary font-display text-[28px] font-bold text-white"
          >
            {storeInitials(store.name)}
          </span>
        )}

        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight lg:text-3xl">{store.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[store.description, store.city].filter(Boolean).join(" · ")}
          </p>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Información de la tienda">
          <li>
            <Badge size="md" tone={status.open ? "success" : "neutral"} dot>
              {status.label}
            </Badge>
          </li>
          {deliveries.map((label) => {
            const Icon = deliveryIcons[label.split(" ")[0] ?? ""] ?? Truck;
            return (
              <li key={label}>
                <Badge size="md">
                  <Icon aria-hidden />
                  {label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </header>
  );
}
