"use client";

import { PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/shared/api/client";
import type { DeliveryZone, Store } from "@/shared/types";
import { Button, useToast } from "@/shared/ui";

import { saveZones, updateStore } from "../api";
import { type SettingsDraft, type SettingsErrors, settingsPatch, toDraft, validateSettings, zonesChanged, zonesInput } from "../lib/settings";
import {
  DeliverySection,
  FeaturesSection,
  HoursSection,
  PaymentsSection,
  StoreInfoSection,
  StoreLinkCard,
} from "./SettingsSections";

type SettingsFormProps = {
  store: Store;
  zones: DeliveryZone[];
  /** Recién registrada: muestra un aviso de bienvenida. */
  welcome?: boolean;
};

function focusFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('[data-settings] [aria-invalid="true"], [data-settings] [data-error]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target?.matches("input, select, textarea")) target.focus({ preventScroll: true });
  });
}

/** Errores de la API con las claves del formulario (las zonas vienen como "0.name"). */
function apiFieldErrors(error: unknown, prefix = ""): SettingsErrors | null {
  if (!(error instanceof ApiError) || error.code !== "validation") return null;
  const fields = error.body.fields;
  if (typeof fields !== "object" || fields === null) return null;
  return Object.fromEntries(Object.entries(fields as Record<string, string>).map(([k, v]) => [`${prefix}${k}`, v]));
}

/** Configuración de la tienda: datos, horario, entregas, funciones y pagos. */
export function SettingsForm({ store, zones, welcome = false }: SettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState({ store, zones });
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(store, zones));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);

  const zonesDirty = zonesChanged(saved.zones, draft);
  const dirty = zonesDirty || Object.keys(settingsPatch(saved.store, draft)).length > 0;

  // Avisa antes de cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(change: (draft: SettingsDraft) => SettingsDraft) {
    setDraft(change);
  }

  async function save() {
    const found = validateSettings(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ tone: "error", title: "Revisa los campos marcados" });
      focusFirstError();
      return;
    }

    setSaving(true);
    let nextZones = saved.zones;
    try {
      // Primero las zonas: así, al activar el delivery, ya tiene zonas
      if (zonesDirty) {
        try {
          nextZones = await saveZones(zonesInput(draft));
        } catch (error) {
          showSaveError(error, "zones.");
          return;
        }
      }
      const patch = settingsPatch(saved.store, draft);
      const nextStore = Object.keys(patch).length > 0 ? await updateStore(patch) : saved.store;
      setSaved({ store: nextStore, zones: nextZones });
      setDraft(toDraft(nextStore, nextZones));
      toast({ tone: "success", title: "Guardamos los cambios" });
      router.refresh();
    } catch (error) {
      // Las zonas ya se guardaron: se conservan con sus ids nuevos aunque falle lo demás
      if (nextZones !== saved.zones) {
        setSaved((current) => ({ ...current, zones: nextZones }));
        setDraft((current) => ({ ...current, zones: toDraft(saved.store, nextZones).zones }));
      }
      showSaveError(error, "");
    } finally {
      setSaving(false);
    }
  }

  function showSaveError(error: unknown, prefix: string) {
    const fieldErrors = apiFieldErrors(error, prefix);
    if (fieldErrors) {
      setErrors(fieldErrors);
      focusFirstError();
    }
    const description = error instanceof ApiError ? error.message : "Revisa tu conexión e inténtalo otra vez.";
    toast({ tone: "error", title: "No pudimos guardar", description });
  }

  function discard() {
    setDraft(toDraft(saved.store, saved.zones));
    setErrors({});
  }

  const sectionProps = { draft, errors, update };

  return (
    <div data-settings className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">Mi tienda</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Datos, horario, entregas, funciones y pagos.</p>
      </div>

      {welcome && (
        <div role="status" className="flex gap-3 rounded-card border border-whatsapp/30 bg-whatsapp-soft p-4 text-sm">
          <PartyPopper aria-hidden size={22} className="shrink-0 text-whatsapp" />
          <div>
            <p className="font-bold">¡Tu tienda está creada!</p>
            <p className="mt-0.5">Revisa tu horario, cómo entregas y cómo te pagan. Luego sube tus productos y comparte tu link.</p>
          </div>
        </div>
      )}

      <StoreLinkCard slug={saved.store.slug} />
      <StoreInfoSection {...sectionProps} />
      <HoursSection {...sectionProps} />
      <DeliverySection {...sectionProps} />
      <FeaturesSection {...sectionProps} />
      <PaymentsSection {...sectionProps} />

      {dirty && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3 shadow-lg lg:bottom-4">
          <p className="pl-1 text-sm font-semibold">Tienes cambios sin guardar</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={discard} disabled={saving}>
              Descartar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
