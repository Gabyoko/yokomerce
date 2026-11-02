"use client";

import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ImagePicker } from "@/features/products";
import { cn } from "@/shared/lib/cn";
import { PAYMENT_METHOD_LABELS } from "@/shared/lib/orders";
import { storeUrl, storeUrlLabel } from "@/shared/lib/site";
import type { Weekday } from "@/shared/types";
import { Button, Card, fieldControlStyles, Input, PhoneInput, Switch, Textarea } from "@/shared/ui";

import { PAYMENT_METHODS, SETTINGS_LIMITS, type SettingsDraft, type SettingsErrors, WEEKDAY_LABELS, WEEKDAYS } from "../lib/settings";
import { BRAND } from "@/shared/lib/brand";

export type SectionProps = {
  draft: SettingsDraft;
  errors: SettingsErrors;
  update: (change: (draft: SettingsDraft) => SettingsDraft) => void;
};

/** Mensaje de error de un grupo (no de un campo). */
function GroupError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p data-error className="text-[13px] font-medium text-danger" role="alert">
      {message}
    </p>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="flex scroll-mt-6 flex-col gap-5" id={id}>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Bloque que aparece debajo de un interruptor activado. */
function Nested({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 border-l-2 border-primary-soft pl-4">{children}</div>;
}

// ---------------------------------------------------------------------------

/** Link público de la tienda con botones para copiar y abrir. */
export function StoreLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(storeUrl(slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso para copiar: el link queda visible para copiarlo a mano
    }
  }
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-muted">El link de tu tienda</p>
        <p className="truncate text-[15px] font-bold">{storeUrlLabel(slug)}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ExternalLink aria-hidden size={18} />
          Ver tienda
        </a>
      </div>
    </Card>
  );
}

export function StoreInfoSection({ draft, errors, update }: SectionProps) {
  return (
    <Section id="tienda" title="Tu tienda" description="Así te ven tus clientes.">
      <Input
        label="Nombre del negocio"
        maxLength={SETTINGS_LIMITS.name}
        value={draft.name}
        onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        optional
        maxLength={SETTINGS_LIMITS.description}
        placeholder="Qué vendes y qué te hace especial"
        hint={`${draft.description.length} de ${SETTINGS_LIMITS.description}`}
        value={draft.description}
        onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
        error={errors.description}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ImagePicker
          label="Logo"
          shape="square"
          hint="Una foto de tu logo o de tu producto estrella."
          value={draft.logoUrl}
          onChange={(url) => update((d) => ({ ...d, logoUrl: url }))}
        />
        <ImagePicker
          label="Portada"
          shape="wide"
          hint="Va arriba de tu catálogo."
          value={draft.coverUrl}
          onChange={(url) => update((d) => ({ ...d, coverUrl: url }))}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <PhoneInput
          label="WhatsApp donde recibes pedidos"
          value={draft.whatsapp}
          onChange={(e) => update((d) => ({ ...d, whatsapp: e.target.value }))}
          error={errors.whatsapp}
        />
        <Input
          label="Ciudad o distrito"
          maxLength={SETTINGS_LIMITS.city}
          value={draft.city}
          onChange={(e) => update((d) => ({ ...d, city: e.target.value }))}
          error={errors.city}
        />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const DEFAULT_HOURS = { open: "09:00", close: "19:00" };

export function HoursSection({ draft, errors, update }: SectionProps) {
  const setDay = (day: Weekday, hours: SettingsDraft["businessHours"][Weekday]) =>
    update((d) => ({ ...d, businessHours: { ...d.businessHours, [day]: hours } }));

  return (
    <Section id="horario" title="Horario de atención" description="Se muestra en tu tienda y define qué días se puede entregar.">
      <GroupError message={errors.businessHours} />
      <ul className="flex flex-col divide-y divide-border">
        {WEEKDAYS.map((day) => {
          const hours = draft.businessHours[day];
          const error = errors[`businessHours.${day}`];
          return (
            <li key={day} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
              <Switch
                label={WEEKDAY_LABELS[day]}
                description={hours ? undefined : "Cerrado"}
                checked={hours !== null}
                onCheckedChange={(on) => setDay(day, on ? DEFAULT_HOURS : null)}
                className="sm:w-56 sm:flex-row-reverse sm:justify-end"
              />
              {hours && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <label className="sr-only" htmlFor={`open-${day}`}>
                      {WEEKDAY_LABELS[day]}: abre
                    </label>
                    <input
                      id={`open-${day}`}
                      type="time"
                      value={hours.open}
                      aria-invalid={error ? true : undefined}
                      onChange={(e) => setDay(day, { ...hours, open: e.target.value })}
                      className={cn(fieldControlStyles(Boolean(error)), "h-11 w-32 px-3")}
                    />
                    <span className="text-ink-muted">a</span>
                    <label className="sr-only" htmlFor={`close-${day}`}>
                      {WEEKDAY_LABELS[day]}: cierra
                    </label>
                    <input
                      id={`close-${day}`}
                      type="time"
                      value={hours.close}
                      aria-invalid={error ? true : undefined}
                      onChange={(e) => setDay(day, { ...hours, close: e.target.value })}
                      className={cn(fieldControlStyles(Boolean(error)), "h-11 w-32 px-3")}
                    />
                  </div>
                  {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------

let newZoneCount = 0;

/** Lista editable de zonas de delivery: distrito, precio, activa, quitar. */
export function ZonesEditor({ draft, errors, update }: SectionProps) {
  const setZone = (index: number, change: Partial<SettingsDraft["zones"][number]>) =>
    update((d) => ({ ...d, zones: d.zones.map((z, i) => (i === index ? { ...z, ...change } : z)) }));

  return (
    <div className="flex flex-col gap-3">
      <GroupError message={errors.zones} />
      {draft.zones.length > 0 && (
        <ul className="flex flex-col gap-3">
          {draft.zones.map((zone, index) => (
            <li key={zone.key} className="flex flex-col gap-2 rounded-control border border-border p-3">
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Input
                  label="Distrito o zona"
                  maxLength={SETTINGS_LIMITS.zoneName}
                  value={zone.name}
                  onChange={(e) => setZone(index, { name: e.target.value })}
                  error={errors[`zones.${index}.name`]}
                />
                <Input
                  label="Precio (S/)"
                  inputMode="decimal"
                  placeholder="8"
                  value={zone.price}
                  onChange={(e) => setZone(index, { price: e.target.value })}
                  error={errors[`zones.${index}.priceCents`]}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Switch
                  label="Activa"
                  checked={zone.active}
                  onCheckedChange={(active) => setZone(index, { active })}
                  className="flex-row-reverse justify-end"
                />
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => update((d) => ({ ...d, zones: d.zones.filter((_, i) => i !== index) }))}
                >
                  <Trash2 aria-hidden />
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        className="self-start"
        onClick={() =>
          update((d) => ({ ...d, zones: [...d.zones, { key: `nueva-${++newZoneCount}`, name: "", price: "", active: true }] }))
        }
      >
        <Plus aria-hidden />
        Agregar zona
      </Button>
    </div>
  );
}

export function DeliverySection(props: SectionProps) {
  const { draft, errors, update } = props;
  const setFeature = (key: "deliveryZones" | "pickup" | "shipping", on: boolean) =>
    update((d) => ({ ...d, features: { ...d.features, [key]: on } }));

  return (
    <Section id="entregas" title="Entregas" description="Elige cómo reciben tus clientes sus pedidos. Activa al menos una.">
      <GroupError message={errors.features} />
      <Switch
        label="Delivery por zonas"
        description="El cliente elige su distrito y se suma el precio de la zona."
        checked={draft.features.deliveryZones}
        onCheckedChange={(on) => setFeature("deliveryZones", on)}
      />
      {draft.features.deliveryZones && (
        <Nested>
          <ZonesEditor {...props} />
        </Nested>
      )}
      <Switch
        label="Recojo en tienda"
        description="Gratis. El cliente pasa a recoger su pedido."
        checked={draft.features.pickup}
        onCheckedChange={(on) => setFeature("pickup", on)}
      />
      {draft.features.pickup && (
        <Nested>
          <Input
            label="Dirección de recojo"
            maxLength={SETTINGS_LIMITS.address}
            placeholder="Jr. Las Gardenias 245, Santiago de Surco"
            value={draft.pickupAddress}
            onChange={(e) => update((d) => ({ ...d, pickupAddress: e.target.value }))}
            error={errors.pickupAddress}
          />
        </Nested>
      )}
      <Switch
        label="Envío a provincia"
        description="El cliente indica su ciudad. Precio fijo o a coordinar."
        checked={draft.features.shipping}
        onCheckedChange={(on) => setFeature("shipping", on)}
      />
      {draft.features.shipping && (
        <Nested>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-semibold">Costo del envío</legend>
            {(
              [
                ["fixed", "Precio fijo"],
                ["coordinate", "A coordinar con el cliente"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input
                  type="radio"
                  name="shippingMode"
                  className="size-5 accent-primary"
                  checked={draft.shippingMode === mode}
                  onChange={() => update((d) => ({ ...d, shippingMode: mode }))}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {draft.shippingMode === "fixed" && (
            <Input
              label="Precio del envío (S/)"
              inputMode="decimal"
              placeholder="15"
              wrapperClassName="max-w-48"
              value={draft.shippingFee}
              onChange={(e) => update((d) => ({ ...d, shippingFee: e.target.value }))}
              error={errors.shippingFeeCents}
            />
          )}
        </Nested>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function FeaturesSection({ draft, errors, update }: SectionProps) {
  const setFeature = (key: "deliveryDate" | "madeToOrder" | "sizeGuide", on: boolean) =>
    update((d) => ({ ...d, features: { ...d.features, [key]: on } }));

  return (
    <Section id="funciones" title="Funciones" description="Actívalas según cómo trabaja tu negocio. Lo que apagues no aparece en tu tienda.">
      <Switch
        label="Fecha de entrega"
        description="El cliente elige el día en que recibe su pedido."
        checked={draft.features.deliveryDate}
        onCheckedChange={(on) => setFeature("deliveryDate", on)}
      />
      {draft.features.deliveryDate && (
        <Nested>
          <Input
            label="Días de anticipación"
            type="number"
            inputMode="numeric"
            min={0}
            max={SETTINGS_LIMITS.leadTimeDays}
            wrapperClassName="max-w-48"
            hint="0 = pueden pedir para hoy. 1 = desde mañana."
            value={draft.features.leadTimeDays}
            onChange={(e) => update((d) => ({ ...d, features: { ...d.features, leadTimeDays: e.target.value } }))}
            error={errors["features.leadTimeDays"]}
          />
        </Nested>
      )}
      <Switch
        label="Pedidos por encargo"
        description="Puedes marcar productos que preparas cuando te los piden, sin controlar stock."
        checked={draft.features.madeToOrder}
        onCheckedChange={(on) => setFeature("madeToOrder", on)}
      />
      <Switch
        label="Guía de tallas"
        description="Puedes adjuntar una imagen con las medidas a tus productos."
        checked={draft.features.sizeGuide}
        onCheckedChange={(on) => setFeature("sizeGuide", on)}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function PaymentsSection({ draft, errors, update }: SectionProps) {
  const toggle = (method: (typeof PAYMENT_METHODS)[number], on: boolean) =>
    update((d) => ({
      ...d,
      paymentMethods: on ? [...d.paymentMethods, method] : d.paymentMethods.filter((m) => m !== method),
    }));

  return (
    <Section id="pagos" title="Pagos" description={`Tus clientes te pagan directo a ti. ${BRAND.name} no cobra comisión.`}>
      <fieldset className="flex flex-col gap-2.5" data-invalid={errors.paymentMethods ? true : undefined}>
        <legend className="mb-2.5 text-[15px] font-semibold">Métodos que aceptas</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control border border-border bg-surface px-3.5 text-[15px] font-bold",
                "hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
              )}
            >
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={draft.paymentMethods.includes(method)}
                onChange={(e) => toggle(method, e.target.checked)}
              />
              {PAYMENT_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
        <GroupError message={errors.paymentMethods} />
      </fieldset>
      <Textarea
        label="Instrucciones de pago"
        optional
        maxLength={SETTINGS_LIMITS.instructions}
        placeholder="Yape o Plin al 912 345 678 a nombre de Ana Torres. Envía la captura por WhatsApp."
        hint="Las ve el cliente al hacer su pedido."
        value={draft.paymentInstructions}
        onChange={(e) => update((d) => ({ ...d, paymentInstructions: e.target.value }))}
        error={errors.paymentInstructions}
      />
      <Input
        label="Horas de reserva"
        type="number"
        inputMode="numeric"
        min={1}
        max={SETTINGS_LIMITS.reservationHours}
        wrapperClassName="max-w-48"
        hint="Cuánto tiempo separas los productos mientras el cliente paga. Después, el pedido vence."
        value={draft.reservationHours}
        onChange={(e) => update((d) => ({ ...d, reservationHours: e.target.value }))}
        error={errors.reservationHours}
      />
    </Section>
  );
}
