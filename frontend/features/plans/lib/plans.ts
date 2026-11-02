import type { PlanId, Store } from "@/shared/types";

/** SPEC.md, sección 10. */
export const PLANS = {
  free: { maxProducts: 20, maxMembers: 1, statsRange: "today", showBranding: true, stockHistory: false },
  pro: { maxProducts: null, maxMembers: 5, statsRange: "all", showBranding: false, stockHistory: true },
} as const;

type Plan = (typeof PLANS)[PlanId];
export type PlanLimitKey = "maxProducts" | "maxMembers";
/**
 * Funciones de Pro que se muestran con candado:
 * - stockHistory: historial de movimientos de stock.
 * - fullStats: métricas de la semana y lo más vendido (el plan gratis solo ve las de hoy).
 * - hideBranding: tienda sin "Hecho con <marca>".
 */
export type PlanFeature = "stockHistory" | "fullStats" | "hideBranding";

/** Días que un plan Pro vencido sigue funcionando. */
export const GRACE_DAYS = 7;

/** Durante la beta (NEXT_PUBLIC_PLANS_ENFORCED distinto de "true") todos se comportan como Pro. */
export function plansEnforced(): boolean {
  return process.env.NEXT_PUBLIC_PLANS_ENFORCED === "true";
}

/** Plan que se aplica hoy: Pro vencido hace más de 7 días cuenta como gratis. */
export function effectivePlan(store: Pick<Store, "plan" | "planExpiresAt">, now: Date = new Date()): PlanId {
  if (!plansEnforced()) return "pro";
  if (store.plan === "pro" && store.planExpiresAt) {
    const graceEnd = new Date(store.planExpiresAt).getTime() + GRACE_DAYS * 24 * 60 * 60_000;
    if (now.getTime() > graceEnd) return "free";
  }
  return store.plan;
}

function planOf(store: Pick<Store, "plan" | "planExpiresAt">, now?: Date): Plan {
  return PLANS[effectivePlan(store, now)];
}

/** Límite numérico del plan; null = sin límite. */
export function getLimit(store: Pick<Store, "plan" | "planExpiresAt">, key: PlanLimitKey, now?: Date): number | null {
  return planOf(store, now)[key];
}

/** Si una función de Pro está disponible (si no, la interfaz muestra un candado). */
export function canUse(store: Pick<Store, "plan" | "planExpiresAt">, feature: PlanFeature, now?: Date): boolean {
  const plan = planOf(store, now);
  if (feature === "fullStats") return plan.statsRange === "all";
  if (feature === "hideBranding") return !plan.showBranding;
  return plan.stockHistory;
}

/** Precio mensual del Pro en céntimos; null mientras no esté definido (SPEC.md, sección 10). */
export const PRO_PRICE_CENTS: number | null = null;

/** Lo que incluye cada plan, para la landing y la página de plan. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: ["Hasta 20 productos", "Pedidos ilimitados por WhatsApp", "Panel de pedidos y control de stock", "Métricas del día"],
  pro: [
    "Productos ilimitados",
    "Historial de movimientos de stock",
    "Métricas de la semana y lo más vendido",
    "Hasta 5 personas en tu panel",
    "Tu tienda sin nuestra marca",
  ],
};
