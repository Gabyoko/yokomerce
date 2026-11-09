"use client";

import { Camera, CircleAlert, CircleCheck, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { saveOptionsHelp, uploadPhoto } from "@/features/products";
import { checkSlug, cleanSlugInput, createStore, saveZones, slugProblem, suggestSlug, updateStore } from "@/features/store-settings";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { SITE_URL } from "@/shared/lib/site";
import { Button, Field, fieldControlStyles, fieldDescribedBy, Input, PhoneInput, Switch, useToast } from "@/shared/ui";

import {
  createStoreInput,
  emptyRegisterDraft,
  QUESTIONS,
  REGISTER_STEPS,
  type RegisterDraft,
  type RegisterErrors,
  registerZones,
  type SlugStatus,
  validateRegisterStep,
} from "../lib/register";
import { createAccount, currentEmail } from "../api";
import { AuthFailure, PASSWORD_MIN } from "../lib/auth-errors";
import { AuthShell } from "./AuthShell";

const SLUG_CHECK_DELAY_MS = 400;
const siteHost = SITE_URL.replace(/^https?:\/\//, "");

function focusFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('[data-register] [aria-invalid="true"], [data-register] [data-error]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target?.matches("input")) target.focus({ preventScroll: true });
  });
}

let zoneCount = 0;

/**
 * Registro del dueño en 3 pasos (SPEC.md, sección 3). Al final crea la cuenta (Supabase) y luego la tienda.
 * Si ya hay sesión (se creó la cuenta pero no la tienda), no vuelve a pedir correo ni contraseña.
 */
export function RegisterFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<RegisterDraft>(emptyRegisterDraft);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [logo, setLogo] = useState<{ file: File; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Correo de la sesión actual: undefined mientras se revisa, null si no hay sesión. */
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined);
  const needsAccount = sessionEmail === null;
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slugRequest = useRef(0);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentEmail()
      .then(setSessionEmail)
      .catch(() => setSessionEmail(null));
  }, []);

  // Libera la vista previa del logo al cambiarla o al salir
  useEffect(() => () => (logo ? URL.revokeObjectURL(logo.preview) : undefined), [logo]);

  function set<K extends keyof RegisterDraft>(key: K, value: RegisterDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  }

  /** Pregunta a la API si el link está libre, cuando se deja de escribir. */
  function changeSlug(slug: string) {
    set("slug", slug);
    clearTimeout(slugTimer.current);
    const request = ++slugRequest.current;
    if (slugProblem(slug)) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    slugTimer.current = setTimeout(async () => {
      try {
        const { available } = await checkSlug(slug);
        if (request === slugRequest.current) setSlugStatus(available ? "available" : "taken");
      } catch {
        if (request === slugRequest.current) setSlugStatus("error");
      }
    }, SLUG_CHECK_DELAY_MS);
  }

  function changeName(name: string) {
    set("name", name);
    if (!slugTouched) changeSlug(suggestSlug(name));
  }

  function next(event: FormEvent) {
    event.preventDefault();
    const found = validateRegisterStep(step, draft, slugStatus, needsAccount);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }
    if (step < REGISTER_STEPS) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    } else {
      void submit();
    }
  }

  async function submit() {
    setSubmitting(true);
    if (needsAccount) {
      try {
        await createAccount(draft.email, draft.password);
        setSessionEmail(draft.email.trim());
      } catch (error) {
        // Un error inesperado (no de Supabase) queda en la consola para poder revisarlo
        if (!(error instanceof AuthFailure)) console.error("No se pudo crear la cuenta", error);
        setSubmitting(false);
        setStep(1);
        const message = error instanceof AuthFailure ? error.message : "Revisa tu conexión e inténtalo otra vez.";
        if (error instanceof AuthFailure && error.code === "weak_password") setErrors({ password: message });
        else setErrors({ email: message });
        focusFirstError();
        return;
      }
    }
    try {
      await createStore(createStoreInput(draft));
    } catch (error) {
      setSubmitting(false);
      const fields = error instanceof ApiError && typeof error.body.fields === "object" ? (error.body.fields as RegisterErrors) : null;
      if (fields) {
        setErrors(fields);
        setStep(fields.ownerName ? 1 : 2);
        focusFirstError();
      }
      toast({
        tone: "error",
        title: "No pudimos crear tu tienda",
        description: error instanceof ApiError ? error.message : "Revisa tu conexión e inténtalo otra vez.",
      });
      return;
    }

    // La tienda ya existe: lo que sigue es opcional y no detiene el registro si falla
    saveOptionsHelp(draft.answers.variants === true);
    try {
      const zones = registerZones(draft);
      if (zones.length > 0) {
        await saveZones(zones);
        await updateStore({ features: { deliveryZones: true } });
      }
      if (logo) {
        await updateStore({ logoUrl: await uploadPhoto(logo.file) });
      }
    } catch {
      toast({ tone: "info", title: "Tu tienda está creada", description: "Algunos datos no se guardaron. Revísalos en Configuración." });
    }
    router.push("/panel/configuracion?bienvenida=1");
  }

  const titles = [
    { title: "Empecemos", subtitle: "Crea tu tienda gratis en 2 minutos. No necesitas tarjeta." },
    { title: "Crea tu tienda", subtitle: "Así te van a ver tus clientes. Puedes cambiarlo después." },
    { title: "Cuéntanos cómo trabajas", subtitle: "Activamos solo lo que necesitas. Puedes cambiarlo después en Configuración." },
  ];
  const { title, subtitle } = titles[step - 1] ?? titles[0]!;
  const slugId = "registro-slug";

  return (
    <AuthShell step={{ current: step, total: REGISTER_STEPS }}>
      <form noValidate onSubmit={next} data-register className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>
        </div>

        {step === 1 && (
          <>
            <Input
              label="¿Cómo te llamas?"
              autoComplete="name"
              maxLength={60}
              placeholder="Ana Torres"
              value={draft.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
              error={errors.ownerName}
            />
            {needsAccount && (
              <>
                <Input
                  label="Correo"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="ana@gmail.com"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  error={errors.email}
                />
                <Input
                  label="Contraseña"
                  type="password"
                  autoComplete="new-password"
                  hint={`Al menos ${PASSWORD_MIN} caracteres.`}
                  value={draft.password}
                  onChange={(e) => set("password", e.target.value)}
                  error={errors.password}
                />
              </>
            )}
            {sessionEmail && (
              <p className="rounded-control border border-border bg-surface px-3.5 py-3 text-sm text-ink-muted">
                Entraste como <span className="font-semibold text-ink">{sessionEmail}</span>. Ahora crea tu tienda.
              </p>
            )}
            <p className="text-sm text-ink-muted">
              ¿Ya tienes tienda?{" "}
              <Link href="/ingresar" className="font-semibold text-primary hover:text-primary-hover">
                Ingresa
              </Link>
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                aria-label={logo ? "Cambiar logo" : "Subir logo"}
                className="flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-border-strong bg-surface text-ink-muted hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo.preview} alt="" className="size-full object-cover" />
                ) : (
                  <Camera aria-hidden size={24} />
                )}
              </button>
              <div className="text-sm">
                <p className="font-semibold">{logo ? "Logo listo" : "Subir logo"} <span className="font-medium text-ink-muted">(opcional)</span></p>
                <p className="text-ink-muted">Una foto de tu logo o de tu producto estrella.</p>
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file?.type.startsWith("image/")) setLogo({ file, preview: URL.createObjectURL(file) });
                }}
              />
            </div>

            <Input
              label="Nombre del negocio"
              maxLength={60}
              placeholder="Dulces de Ana"
              value={draft.name}
              onChange={(e) => changeName(e.target.value)}
              error={errors.name}
            />

            <Field id={slugId} label="Link de tu tienda" error={errors.slug}>
              <div
                className={cn(
                  fieldControlStyles(Boolean(errors.slug)),
                  "flex h-12 items-center gap-0.5 pl-3.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-primary",
                )}
              >
                <span className="shrink-0 text-ink-muted" aria-hidden>
                  {siteHost}/
                </span>
                <input
                  id={slugId}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    changeSlug(cleanSlugInput(e.target.value));
                  }}
                  aria-invalid={errors.slug ? true : undefined}
                  aria-describedby={fieldDescribedBy(slugId, undefined, errors.slug) ?? `${slugId}-status`}
                  className="h-full min-w-0 flex-1 bg-transparent pr-3.5 font-semibold outline-none"
                />
              </div>
              {!errors.slug && <SlugStatusLine id={`${slugId}-status`} slug={draft.slug} status={slugStatus} />}
            </Field>

            <PhoneInput
              label="WhatsApp donde recibes pedidos"
              value={draft.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              error={errors.whatsapp}
            />
            <Input
              label="Ciudad o distrito"
              autoComplete="address-level2"
              maxLength={60}
              placeholder="Santiago de Surco"
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
              error={errors.city}
            />

            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <Switch
                label="Hago delivery"
                description="Agrega los distritos donde entregas y cuánto cobras."
                checked={draft.delivery}
                onCheckedChange={(on) => {
                  set("delivery", on);
                  if (on && draft.zones.length === 0) set("zones", [{ key: `z${++zoneCount}`, name: "", price: "" }]);
                }}
              />
              {draft.delivery && (
                <div className="flex flex-col gap-3">
                  {errors.zones && (
                    <p data-error className="text-[13px] font-medium text-danger">
                      {errors.zones}
                    </p>
                  )}
                  {draft.zones.map((zone, index) => (
                    <div key={zone.key} className="grid grid-cols-[1fr_6rem_auto] items-start gap-2">
                      <Input
                        label="Distrito"
                        placeholder="Surco"
                        maxLength={60}
                        value={zone.name}
                        onChange={(e) => set("zones", draft.zones.map((z, i) => (i === index ? { ...z, name: e.target.value } : z)))}
                        error={errors[`zones.${index}.name`]}
                      />
                      <Input
                        label="S/"
                        inputMode="decimal"
                        placeholder="8"
                        value={zone.price}
                        onChange={(e) => set("zones", draft.zones.map((z, i) => (i === index ? { ...z, price: e.target.value } : z)))}
                        error={errors[`zones.${index}.priceCents`]}
                      />
                      <Button
                        iconOnly
                        variant="ghost"
                        aria-label={`Quitar ${zone.name || "zona"}`}
                        className="mt-7"
                        onClick={() => set("zones", draft.zones.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() => set("zones", [...draft.zones, { key: `z${++zoneCount}`, name: "", price: "" }])}
                  >
                    <Plus aria-hidden />
                    Agregar zona
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {QUESTIONS.map(({ key, question, hint }) => {
              const error = errors[`answers.${key}`];
              return (
                <fieldset
                  key={key}
                  data-error={error ? true : undefined}
                  className={cn("flex flex-col gap-3 rounded-card border bg-surface p-4", error ? "border-danger" : "border-border")}
                >
                  <legend className="sr-only">{question}</legend>
                  <div aria-hidden>
                    <p className="text-[15px] font-bold">{question}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[true, false].map((value) => (
                      <label
                        key={String(value)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border text-[15px] font-semibold",
                          "hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-hover",
                          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                        )}
                      >
                        <input
                          type="radio"
                          name={key}
                          className="sr-only"
                          checked={draft.answers[key] === value}
                          onChange={() => {
                            set("answers", { ...draft.answers, [key]: value });
                            if (error) setErrors((current) => ({ ...current, [`answers.${key}`]: "" }));
                          }}
                        />
                        {value ? "Sí" : "No"}
                      </label>
                    ))}
                  </div>
                  {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
                </fieldset>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button type="submit" size="lg" fullWidth loading={submitting} className="rounded-[16px]">
            {step < REGISTER_STEPS ? "Continuar" : "Crear mi tienda"}
          </Button>
          {step > 1 && (
            <Button variant="ghost" size="lg" fullWidth disabled={submitting} onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}

function SlugStatusLine({ id, slug, status }: { id: string; slug: string; status: SlugStatus }) {
  const base = "flex items-center gap-1.5 text-[13px] font-medium";
  if (!slug) {
    return (
      <p id={id} className={cn(base, "text-ink-muted")}>
        Se arma solo con el nombre de tu negocio. Puedes cambiarlo.
      </p>
    );
  }
  const problem = slugProblem(slug);
  if (problem) {
    return (
      <p id={id} className={cn(base, "text-ink-muted")}>
        {problem}
      </p>
    );
  }
  const states: Record<SlugStatus, { icon: typeof CircleCheck; text: string; className: string }> = {
    idle: { icon: LoaderCircle, text: "Revisando…", className: "text-ink-muted [&_svg]:animate-spin" },
    checking: { icon: LoaderCircle, text: "Revisando…", className: "text-ink-muted [&_svg]:animate-spin" },
    available: { icon: CircleCheck, text: "Disponible", className: "text-whatsapp" },
    taken: { icon: CircleAlert, text: "Ya está en uso. Prueba con otro.", className: "text-danger" },
    error: { icon: CircleAlert, text: "No pudimos revisarlo. Lo revisaremos al crear tu tienda.", className: "text-ink-muted" },
  };
  const { icon: Icon, text, className } = states[status];
  return (
    <p id={id} aria-live="polite" className={cn(base, className)}>
      <Icon aria-hidden size={14} className="shrink-0" />
      {text}
    </p>
  );
}
