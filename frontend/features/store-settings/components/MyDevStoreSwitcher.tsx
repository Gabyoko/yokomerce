import { loadMyStore } from "../queries";
import { DevStoreSwitcher } from "./DevStoreSwitcher";

/** Selector de tiendas de prueba con la tienda actual ya elegida. */
export async function MyDevStoreSwitcher({ className }: { className?: string }) {
  if (process.env.NODE_ENV === "production") return null;
  const store = await loadMyStore();
  return <DevStoreSwitcher current={store.slug} className={className} />;
}
