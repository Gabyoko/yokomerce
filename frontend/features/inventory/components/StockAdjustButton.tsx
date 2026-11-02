"use client";

import { Lock, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { formatOrderTime } from "@/shared/lib/dates";
import type { ProductAdmin, StockMovement } from "@/shared/types";
import { Button, type ButtonVariant, Input, Modal, Select, Skeleton, useToast } from "@/shared/ui";

import { adjustStock, listStockMovements } from "../api";
import {
  ADJUST_TYPES,
  type AdjustType,
  movementLabel,
  previewAdjustment,
  REASON_LABELS,
  REASONS_BY_TYPE,
  signedQuantity,
} from "../lib/adjust";

type StockAdjustButtonProps = {
  product: ProductAdmin;
  /** Variante que se abre primero (si no, la primera activa). */
  variantId?: string;
  /** Plan con historial de movimientos (si no, se muestra con candado). */
  canSeeHistory: boolean;
  label?: string;
  variant?: ButtonVariant;
  className?: string;
  /** Tipo de ajuste elegido al abrir. */
  initialType?: AdjustType;
  /** Después de guardar (además de router.refresh). */
  onDone?: () => void;
  /** Icono antes del texto del botón. */
  icon?: ReactNode;
};

type History = { status: "loading" } | { status: "ready"; movements: StockMovement[] } | { status: "error" };

const OTHER = "__otro__";
const HISTORY_SHOWN = 8;

/**
 * Botón que abre el ajuste rápido de stock (design/AjusteStock.dc.html).
 * No usar con productos por encargo (no llevan stock).
 * En el celular la ventana sale desde abajo a pantalla casi completa; en computadora es un modal.
 */
export function StockAdjustButton({
  product,
  variantId,
  canSeeHistory,
  label = "Ajustar stock",
  variant = "secondary",
  className,
  initialType = "in",
  onDone,
  icon,
}: StockAdjustButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(variantId ?? product.variants.find((v) => v.active)?.id ?? product.variants[0]?.id ?? "");
  const [type, setType] = useState<AdjustType>("in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(REASONS_BY_TYPE.in[0]!);
  const [otherReason, setOtherReason] = useState("");
  const [history, setHistory] = useState<History>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const historyRequest = useRef(0);

  const current = product.variants.find((v) => v.id === selectedId) ?? product.variants[0];
  if (!current) return null;

  const amount = Number(quantity);
  const preview = previewAdjustment(current, type, quantity.trim() === "" ? NaN : amount);
  const finalReason = reason === OTHER ? otherReason.trim() : reason;
  const available = current.onHand - current.reserved;

  async function loadHistory(id: string) {
    if (!canSeeHistory) return;
    const request = ++historyRequest.current;
    setHistory({ status: "loading" });
    try {
      const movements = await listStockMovements(id);
      if (request === historyRequest.current) setHistory({ status: "ready", movements });
    } catch {
      if (request === historyRequest.current) setHistory({ status: "error" });
    }
  }

  function openModal() {
    setType(initialType);
    setQuantity(initialType === "adjust" ? String(current!.onHand) : "1");
    setReason(REASONS_BY_TYPE[initialType][0]!);
    setOtherReason("");
    setOpen(true);
    void loadHistory(selectedId);
  }

  function changeType(next: AdjustType) {
    setType(next);
    setReason(REASONS_BY_TYPE[next][0]!);
    setQuantity(next === "adjust" ? String(current!.onHand) : "1");
  }

  async function save() {
    if (!preview.ok || !finalReason) return;
    setSaving(true);
    try {
      await adjustStock(current!.id, { type, quantity: amount, reason: finalReason });
      toast({ tone: "success", title: "Guardamos el ajuste", description: `${product.name}${current!.label ? ` (${current!.label})` : ""}: ${preview.available} disponibles.` });
      setOpen(false);
      onDone?.();
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "No pudimos guardar el ajuste", description: error instanceof ApiError ? error.message : "Revisa tu conexión e inténtalo otra vez." });
    } finally {
      setSaving(false);
    }
  }

  const stepQuantity = (delta: number) => setQuantity(String(Math.max(type === "adjust" ? 0 : 1, (Number(quantity) || 0) + delta)));

  return (
    <>
      <Button variant={variant} className={className} onClick={openModal}>
        {icon}
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajustar stock"
        description={product.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={!preview.ok || !finalReason}>
              Guardar ajuste
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {product.variants.length > 1 && (
            <Select
              label="Combinación"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                if (type === "adjust") setQuantity(String(product.variants.find((v) => v.id === e.target.value)?.onHand ?? 0));
                void loadHistory(e.target.value);
              }}
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.active ? "" : " (inactiva)"} · {v.onHand - v.reserved} disp.
                </option>
              ))}
            </Select>
          )}

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["En total", current.onHand],
              ["Reservado", current.reserved],
              ["Disponible", available],
            ].map(([name, value]) => (
              <div key={name} className="rounded-control bg-bg px-2 py-3">
                <dt className="text-[13px] text-ink-muted">{name}</dt>
                <dd className="font-display text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>

          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">¿Qué pasó?</legend>
            <div className="grid grid-cols-3 gap-2">
              {ADJUST_TYPES.map((t) => (
                <label
                  key={t.type}
                  title={t.hint}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-border px-2 text-center text-sm font-bold",
                    "hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-hover",
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                  )}
                >
                  <input type="radio" name="adjust-type" className="sr-only" checked={type === t.type} onChange={() => changeType(t.type)} />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">{ADJUST_TYPES.find((t) => t.type === type)?.hint}.</p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="adjust-quantity" className="text-[15px] font-semibold">
              {type === "adjust" ? "Total exacto" : "Unidades"}
            </label>
            <div className="flex items-center gap-2">
              <Button iconOnly variant="secondary" aria-label="Una menos" onClick={() => stepQuantity(-1)}>
                <Minus />
              </Button>
              <input
                id="adjust-quantity"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                aria-invalid={!preview.ok || undefined}
                aria-describedby="adjust-preview"
                className="h-12 w-24 rounded-field border border-border bg-surface text-center font-display text-2xl font-bold focus-visible:outline-2 focus-visible:outline-primary"
              />
              <Button iconOnly variant="secondary" aria-label="Una más" onClick={() => stepQuantity(1)}>
                <Plus />
              </Button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">Motivo</legend>
            <div className="flex flex-wrap gap-2">
              {[...REASONS_BY_TYPE[type], OTHER].map((code) => (
                <label
                  key={code}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center rounded-full border border-border px-4 text-sm font-semibold",
                    "hover:border-border-strong has-checked:border-ink has-checked:bg-ink has-checked:text-white",
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                  )}
                >
                  <input type="radio" name="adjust-reason" className="sr-only" checked={reason === code} onChange={() => setReason(code)} />
                  {code === OTHER ? "Otro" : REASON_LABELS[code]}
                </label>
              ))}
            </div>
            {reason === OTHER && (
              <Input
                label="¿Cuál?"
                wrapperClassName="mt-3"
                maxLength={60}
                autoFocus
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            )}
          </fieldset>

          <p
            id="adjust-preview"
            aria-live="polite"
            className={cn("flex items-center justify-between rounded-control p-3.5 text-[15px]", preview.ok ? "bg-whatsapp-soft" : "bg-danger-soft text-danger")}
          >
            {preview.ok ? (
              <>
                <span className="font-semibold">Disponible después</span>
                <span className="font-display text-xl font-bold">
                  {available} → {preview.available}
                </span>
              </>
            ) : (
              <span className="font-semibold">{preview.message}</span>
            )}
          </p>

          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-bold">Últimos movimientos</h3>
              {current.lowStockThreshold !== null && <span className="text-[13px] text-ink-muted">Aviso si baja de {current.lowStockThreshold}</span>}
            </div>
            {!canSeeHistory ? (
              <Link href="/panel/plan" className="flex items-center gap-2 rounded-control border border-dashed border-border-strong p-3 text-sm text-ink-muted hover:text-primary">
                <Lock aria-hidden size={16} />
                El historial de movimientos es parte del plan Pro.
              </Link>
            ) : history.status === "loading" ? (
              <div aria-busy="true" className="flex flex-col gap-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : history.status === "error" ? (
              <p className="text-sm text-ink-muted">No pudimos cargar el historial.</p>
            ) : history.movements.length === 0 ? (
              <p className="text-sm text-ink-muted">Todavía no hay movimientos.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {history.movements.slice(0, HISTORY_SHOWN).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{movementLabel(m)}</span>
                      <span className="block text-[13px] text-ink-muted">
                        {formatOrderTime(m.createdAt)} · {m.createdBy ?? "automático"}
                      </span>
                    </span>
                    <span className={cn("shrink-0 font-bold", m.quantity > 0 ? "text-whatsapp" : m.quantity < 0 ? "text-danger" : "text-ink-muted")}>
                      {signedQuantity(m.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}
