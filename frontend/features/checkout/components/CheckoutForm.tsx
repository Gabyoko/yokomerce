"use client";

import { MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import {
  type CartAdjustment,
  catalogAvailability,
  fitCartToStock,
  linesTotal,
  reportedAvailability,
  resolveCartLines,
  useCart,
} from "@/features/cart";
import { cn } from "@/shared/lib/cn";
import { formatSoles } from "@/shared/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/shared/lib/orders";
import type { Catalog, ISODate } from "@/shared/types";
import {
  Button,
  buttonStyles,
  Card,
  Input,
  PhoneInput,
  Select,
  useToast,
} from "@/shared/ui";
import { StoreColumns } from "@/shared/ui/layout";

import { createOrder } from "../api";
import { dateChipLabel } from "../lib/delivery-dates";
import {
  buildOrderInput,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm as CheckoutFormValues,
  initialForm,
  LIMITS,
  splitServerErrors,
  validateCheckout,
} from "../lib/form";
import { feeLine, fulfillmentOptions, initialFulfillment } from "../lib/fulfillment";
import { lineDetails } from "./CartLineCard";
import { ChoiceCard, ChoiceGroup } from "./ChoiceCard";
import { FlowHeader } from "./FlowHeader";
import { CheckoutSkeleton } from "./Skeletons";
import { StockNotice } from "./StockNotice";
import { EmptyCart, Totals } from "./Summary";

type CheckoutFormProps = {
  catalog: Pick<Catalog, "store" | "products" | "deliveryZones">;
  /** Días que se pueden elegir (vacío si la tienda no usa fecha de entrega). */
  dates: ISODate[];
  /** Hoy en Lima, calculado en el servidor. */
  today: ISODate;
  /** Forma de entrega elegida en el carrito (?entrega=). */
  preferredFulfillment?: string | null;
};

/** Aviso arriba del formulario después de intentar enviar. */
type Banner =
  | { kind: "stock"; adjustments: CartAdjustment[] }
  | { kind: "items"; messages: string[] }
  | { kind: "rate_limited" };

/** Lleva la vista al primer campo con error y lo enfoca. */
function focusFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(
      '[data-checkout] [aria-invalid="true"], [data-checkout] fieldset[data-invalid] input',
    );
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

/** Datos de entrega y pago (design/Datos.dc.html). */
export function CheckoutForm({ catalog, dates, today, preferredFulfillment }: CheckoutFormProps) {
  const { store, products, deliveryZones: zones } = catalog;
  const { slug } = store;
  const router = useRouter();
  const { toast } = useToast();
  const cart = useCart(slug);
  const ids = useId();

  const options = fulfillmentOptions({ store, zones });
  const ctx = { store, zones, paymentMethods: store.paymentMethods, dates };
  const [form, setForm] = useState<CheckoutFormValues>(() =>
    initialForm(initialFulfillment(options, preferredFulfillment), store.paymentMethods),
  );
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  const header = (
    <FlowHeader
      backHref={`/${slug}/carrito`}
      backLabel="Volver al carrito"
      title="Tus datos"
      subtitle="Paso 2 de 2 · no necesitas crear cuenta"
      step={{ current: 2, total: 2 }}
    />
  );

  // Pedido creado: se vació el carrito y estamos yendo a la página del pedido
  if (!cart.ready || placed) return <CheckoutSkeleton header={header} />;
  if (cart.count === 0) {
    return (
      <div className="flex flex-col">
        {header}
        {banner?.kind === "stock" && (
          <div className="px-5 lg:px-0">
            <StockNotice title="Tu carrito cambió" adjustments={banner.adjustments} products={products} />
          </div>
        )}
        <EmptyCart slug={slug} />
      </div>
    );
  }

  const fit = fitCartToStock(cart.items, catalogAvailability(products));
  const lines = resolveCartLines(cart.items, products);
  const subtotal = linesTotal(lines);
  const fee = feeLine({ store, zones }, form.fulfillmentType, form.zoneId);

  /** Cambia un valor y borra el error de ese campo. */
  function set<K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K], field?: CheckoutField) {
    setForm((current) => ({ ...current, [key]: value }));
    if (field && errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setBanner(null);

    const clientErrors = validateCheckout(form, ctx);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusFirstError();
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder(buildOrderInput(slug, cart.items, form));
      if (result.ok) {
        setPlaced(true);
        cart.clear();
        router.replace(`/${slug}/pedido/${result.order.publicToken}`);
        return;
      }
      if (result.error === "out_of_stock") {
        // Ajustamos el carrito a lo que hay y pedimos el catálogo otra vez para ver el stock actual
        const adjusted = fitCartToStock(cart.items, reportedAvailability(result.items));
        cart.replace(adjusted.items);
        setBanner({ kind: "stock", adjustments: adjusted.adjustments });
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (result.error === "validation") {
        const { form: fieldErrors, other } = splitServerErrors(result.fields);
        setErrors(fieldErrors);
        if (other.length > 0) {
          setBanner({ kind: "items", messages: other });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          focusFirstError();
        }
      } else {
        setBanner({ kind: "rate_limited" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      toast({ tone: "error", title: "No pudimos enviar tu pedido", description: "Revisa tu conexión e inténtalo otra vez." });
    }
    setSubmitting(false);
  }

  const submitButton = (className?: string) => (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-center text-[13px] text-ink-muted">Se abrirá WhatsApp con tu pedido ya escrito.</p>
      <Button type="submit" variant="whatsapp" size="lg" fullWidth loading={submitting} disabled={fit.adjustments.length > 0} className="rounded-[16px]">
        <MessageCircle aria-hidden />
        Enviar pedido por WhatsApp
      </Button>
    </div>
  );

  const sectionTitle = "text-base font-bold";

  return (
    <form noValidate onSubmit={handleSubmit} data-checkout className="flex flex-col gap-2 lg:gap-6">
      {header}
      <div className="px-5 pt-2 lg:px-0">
        <StoreColumns
          hideAsideOnMobile={false}
          aside={
            <div className="flex flex-col gap-4">
              <Card className="flex flex-col gap-3">
                <h2 className={cn(sectionTitle, "hidden lg:block")}>Resumen</h2>
                <ul className="hidden flex-col gap-2 border-b border-border pb-3 text-sm lg:flex">
                  {lines.map((line) => {
                    const details = lineDetails(line);
                    return (
                      <li key={line.index} className="flex justify-between gap-3">
                        <span className="min-w-0">
                          <span className="font-semibold">
                            {line.item.quantity} × {line.product.name}
                          </span>
                          {details && <span className="block truncate text-[13px] text-ink-muted">{details}</span>}
                        </span>
                        <span className="shrink-0 font-semibold">{formatSoles(line.lineTotalCents)}</span>
                      </li>
                    );
                  })}
                </ul>
                <Totals subtotalCents={subtotal} count={cart.count} fee={fee} showTotal />
              </Card>
              <div className="hidden lg:block">{submitButton()}</div>
            </div>
          }
        >
          <div className="flex flex-col gap-7">
            {fit.adjustments.length > 0 && banner?.kind !== "stock" && (
              <StockNotice title="Algunos productos cambiaron" adjustments={fit.adjustments} products={products}>
                <Link href={`/${slug}/carrito`} className={buttonStyles({ variant: "dark", className: "self-start" })}>
                  Revisar mi carrito
                </Link>
              </StockNotice>
            )}
            {banner?.kind === "stock" && (
              <StockNotice title="Ajustamos tu carrito" adjustments={banner.adjustments} products={products}>
                <p>Revisa el resumen y vuelve a enviar tu pedido.</p>
              </StockNotice>
            )}
            {banner?.kind === "items" && (
              <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-sm">
                <p className="font-bold text-danger">Revisa tu carrito</p>
                <ul className="mt-1 list-disc pl-4">
                  {banner.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                <Link href={`/${slug}/carrito`} className="mt-2 inline-block font-semibold text-primary underline">
                  Ir al carrito
                </Link>
              </div>
            )}
            {banner?.kind === "rate_limited" && (
              <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-sm">
                <p className="font-bold text-danger">Hiciste varios pedidos seguidos</p>
                <p className="mt-1">
                  Espera un rato e inténtalo otra vez, o{" "}
                  <a href={`https://wa.me/${store.whatsapp}`} className="font-semibold text-primary underline">
                    escríbele a {store.name} por WhatsApp
                  </a>
                  .
                </p>
              </div>
            )}

            <section className="flex flex-col gap-4">
              <h2 className={sectionTitle}>Contacto</h2>
              <Input
                label="Nombre"
                name="name"
                autoComplete="name"
                maxLength={LIMITS.nameMax}
                value={form.name}
                onChange={(e) => set("name", e.target.value, "customer.name")}
                error={errors["customer.name"]}
              />
              <PhoneInput
                label="Celular"
                name="phone"
                hint="Te escribirán a este número."
                value={form.phone}
                onChange={(e) => set("phone", e.target.value, "customer.phone")}
                error={errors["customer.phone"]}
              />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className={sectionTitle}>Entrega</h2>
              {options.length > 1 && (
                <ChoiceGroup
                  legend="¿Cómo lo recibes?"
                  error={errors["fulfillment.type"]}
                  errorId={`${ids}-type-error`}
                  className="grid grid-cols-2 gap-2.5"
                >
                  {options.map((option) => (
                    <ChoiceCard
                      key={option.type}
                      name="fulfillmentType"
                      value={option.type}
                      checked={form.fulfillmentType === option.type}
                      onChange={() => set("fulfillmentType", option.type, "fulfillment.type")}
                      className="min-h-16 flex-col items-start justify-center gap-0 rounded-[16px]"
                    >
                      <span className="text-[15px] font-bold">{option.title}</span>
                      <span className="text-[13px] text-ink-muted">{option.detail}</span>
                    </ChoiceCard>
                  ))}
                </ChoiceGroup>
              )}
              {options.length === 1 && options[0] && (
                <p className="text-[15px]">
                  <span className="font-semibold">{options[0].title}</span>
                  <span className="text-ink-muted"> · {options[0].detail}</span>
                </p>
              )}

              {form.fulfillmentType === "delivery" && (
                <Select
                  label="Distrito"
                  name="zoneId"
                  placeholder="Elige tu distrito"
                  value={form.zoneId}
                  onChange={(e) => set("zoneId", e.target.value, "fulfillment.zoneId")}
                  error={errors["fulfillment.zoneId"]}
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} · {zone.priceCents === 0 ? "delivery gratis" : `delivery ${formatSoles(zone.priceCents, { trimZeroDecimals: true })}`}
                    </option>
                  ))}
                </Select>
              )}
              {form.fulfillmentType === "shipping" && (
                <Input
                  label="Ciudad"
                  name="city"
                  autoComplete="address-level2"
                  placeholder="Arequipa"
                  maxLength={LIMITS.city}
                  value={form.city}
                  onChange={(e) => set("city", e.target.value, "fulfillment.city")}
                  error={errors["fulfillment.city"]}
                  hint={store.shippingFeeCents === null ? "El costo del envío lo coordinas con la tienda." : undefined}
                />
              )}
              {(form.fulfillmentType === "delivery" || form.fulfillmentType === "shipping") && (
                <>
                  <Input
                    label="Dirección"
                    name="address"
                    autoComplete="street-address"
                    placeholder="Av. Primavera 123, dpto. 402"
                    maxLength={LIMITS.address}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value, "fulfillment.address")}
                    error={errors["fulfillment.address"]}
                  />
                  <Input
                    label="Referencia"
                    optional
                    name="reference"
                    placeholder="Frente al parque, portón negro"
                    maxLength={LIMITS.reference}
                    value={form.reference}
                    onChange={(e) => set("reference", e.target.value, "fulfillment.reference")}
                    error={errors["fulfillment.reference"]}
                  />
                </>
              )}
              {form.fulfillmentType === "pickup" && store.pickupAddress && (
                <p className="flex items-start gap-2.5 rounded-control border border-border bg-surface p-3.5 text-sm">
                  <MapPin aria-hidden size={18} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold">Recoges en</span>
                    {store.pickupAddress}
                  </span>
                </p>
              )}

              {dates.length > 0 && (
                <ChoiceGroup
                  legend="¿Para cuándo?"
                  error={errors.deliveryDate}
                  errorId={`${ids}-date-error`}
                  className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
                >
                  {dates.map((date) => {
                    const label = dateChipLabel(date, today);
                    return (
                      <ChoiceCard
                        key={date}
                        name="deliveryDate"
                        value={date}
                        checked={form.deliveryDate === date}
                        onChange={() => set("deliveryDate", date, "deliveryDate")}
                        className="min-h-14 min-w-19 shrink-0 flex-col justify-center gap-0 px-3 text-center"
                      >
                        <span className="text-xs text-ink-muted">{label.top}</span>
                        <span className="text-[15px] font-bold whitespace-nowrap">{label.bottom}</span>
                      </ChoiceCard>
                    );
                  })}
                </ChoiceGroup>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <ChoiceGroup
                legend={<span className={sectionTitle}>¿Cómo vas a pagar?</span>}
                error={errors.paymentMethod}
                errorId={`${ids}-payment-error`}
                className="grid grid-cols-2 gap-2.5"
              >
                {store.paymentMethods.map((method) => (
                  <ChoiceCard
                    key={method}
                    indicator
                    name="paymentMethod"
                    value={method}
                    checked={form.paymentMethod === method}
                    onChange={() => set("paymentMethod", method, "paymentMethod")}
                    className="min-h-14 text-[15px] font-bold"
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </ChoiceCard>
                ))}
              </ChoiceGroup>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Pagas directo al negocio. {store.paymentInstructions ?? "Te enviará los datos de pago por WhatsApp."}
              </p>
            </section>
          </div>
        </StoreColumns>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-3 pb-[max(1.375rem,env(safe-area-inset-bottom))] lg:hidden">
        {submitButton()}
      </div>
    </form>
  );
}
