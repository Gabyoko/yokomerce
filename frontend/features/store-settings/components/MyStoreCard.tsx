import { storeUrlLabel } from "@/shared/lib/site";
import { PanelStoreCard } from "@/shared/ui/layout";

import { loadMyStore } from "../queries";

/** Tarjeta de la tienda del menú lateral del panel (va dentro de un Suspense). */
export async function MyStoreCard() {
  const store = await loadMyStore();
  return <PanelStoreCard store={{ name: store.name, logoUrl: store.logoUrl, publicUrl: storeUrlLabel(store.slug) }} />;
}
