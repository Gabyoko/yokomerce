import { loadMyProducts } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { PlanCard } from "@/shared/ui/layout";

import { effectivePlan, getLimit, plansEnforced } from "../lib/plans";

/** Tarjeta del plan del menú lateral: nombre y productos usados (va dentro de un Suspense). */
export async function MyPlanCard() {
  const [store, products] = await Promise.all([loadMyStore(), loadMyProducts()]);
  const plan = effectivePlan(store);
  const name = plan === "pro" ? (plansEnforced() ? "Pro" : "Pro · gratis en la beta") : "gratis";
  return <PlanCard plan={{ name, productsUsed: products.length, productsLimit: getLimit(store, "maxProducts") }} />;
}
