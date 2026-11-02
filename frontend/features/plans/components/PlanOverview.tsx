import { Check, Gem, MessageCircle } from "lucide-react";

import { formatDateShort, todayInLima } from "@/shared/lib/dates";
import { formatSoles } from "@/shared/lib/money";
import type { PlanId, Store } from "@/shared/types";
import { Badge, Button, buttonStyles, Card } from "@/shared/ui";

import { effectivePlan, getLimit, GRACE_DAYS, PLAN_FEATURES, plansEnforced, PRO_PRICE_CENTS } from "../lib/plans";
import { upgradeUrl } from "../lib/upgrade";

type PlanOverviewProps = {
  store: Pick<Store, "name" | "plan" | "planExpiresAt">;
  productsUsed: number;
};

const PLAN_NAMES: Record<PlanId, string> = { free: "Gratis", pro: "Pro" };

/** Página de plan: plan actual, uso y comparación (SPEC.md, sección 10). */
export function PlanOverview({ store, productsUsed }: PlanOverviewProps) {
  const enforced = plansEnforced();
  const current = effectivePlan(store);
  const limit = getLimit(store, "maxProducts");
  const upgrade = upgradeUrl(store.name);
  const proPrice = PRO_PRICE_CENTS === null ? "Precio por anunciar" : `${formatSoles(PRO_PRICE_CENTS, { trimZeroDecimals: true })} al mes`;
  const expires = store.plan === "pro" && store.planExpiresAt ? formatDateShort(todayInLima(new Date(store.planExpiresAt))).toLowerCase() : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">Tu plan</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Pedidos ilimitados y sin comisiones por venta en todos los planes.</p>
      </div>

      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Gem aria-hidden size={24} />
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
              Plan {PLAN_NAMES[current]}
              {!enforced && <Badge tone="success">Gratis durante la beta</Badge>}
            </p>
            <p className="text-sm text-ink-muted">
              {!enforced
                ? "Mientras dure la beta tienes todas las funciones de Pro sin pagar."
                : expires
                  ? `Vence el ${expires}. Si no renuevas, sigue funcionando ${GRACE_DAYS} días más.`
                  : "Puedes mejorar cuando lo necesites."}
            </p>
          </div>
        </div>
        <p className="text-[15px]">
          <span className="font-bold">{productsUsed}</span>
          <span className="text-ink-muted">{limit === null ? " productos (sin límite)" : ` de ${limit} productos`}</span>
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((plan) => {
          const isCurrent = enforced && current === plan;
          return (
            <Card key={plan} padding="lg" className={plan === "pro" ? "flex flex-col gap-4 border-2 border-primary" : "flex flex-col gap-4"}>
              <div>
                <p className="flex items-center gap-2 text-lg font-bold">
                  {PLAN_NAMES[plan]}
                  {isCurrent && <Badge tone="dark">Tu plan</Badge>}
                </p>
                <p className="mt-1 font-display text-2xl font-bold">{plan === "free" ? "S/ 0" : proPrice}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2.5">
                {PLAN_FEATURES[plan].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[15px]">
                    <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-whatsapp" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan === "pro" &&
                !isCurrent &&
                (upgrade ? (
                  <a href={upgrade} target="_blank" rel="noreferrer" className={buttonStyles({ size: "lg", fullWidth: true })}>
                    <MessageCircle aria-hidden />
                    Quiero Pro
                  </a>
                ) : (
                  <Button size="lg" fullWidth disabled>
                    Muy pronto
                  </Button>
                ))}
            </Card>
          );
        })}
      </div>

      <p className="text-[13px] text-ink-muted">
        Si tu plan vence, no se borra nada. Si tienes más productos que el límite del plan gratis, siguen en tu tienda, pero no
        podrás crear nuevos hasta renovar.
      </p>
    </div>
  );
}
