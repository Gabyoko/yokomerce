"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button, Input } from "@/shared/ui";

import { signIn } from "../api";
import { AuthFailure, safeNextPath } from "../lib/auth-errors";
import { AuthShell } from "./AuthShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { email?: string; password?: string; form?: string };

/** Ingreso del dueño con correo y contraseña (Supabase Auth). */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) found.email = "Escribe un correo válido, por ejemplo ana@gmail.com.";
    if (!password) found.password = "Escribe tu contraseña.";
    setErrors(found);
    if (found.email || found.password) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      if (!(error instanceof AuthFailure)) console.error("No se pudo ingresar", error);
      setSubmitting(false);
      setErrors({ form: error instanceof AuthFailure ? error.message : "Algo salió mal. Inténtalo otra vez." });
      return;
    }
    // Se lee al enviar (no con useSearchParams) para no necesitar Suspense en la página
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Ingresa a tu tienda</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Con el correo y la contraseña de tu cuenta.</p>
        </div>
        {errors.form && (
          <p role="alert" className="rounded-control bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
            {errors.form}
          </p>
        )}
        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ana@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors({});
          }}
          error={errors.email}
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors({});
          }}
          error={errors.password}
        />
        <Button type="submit" size="lg" fullWidth loading={submitting} className="rounded-[16px]">
          Ingresar
        </Button>
        <p className="text-center text-sm text-ink-muted">
          ¿Aún no tienes tienda?{" "}
          <Link href="/registro" className="font-semibold text-primary hover:text-primary-hover">
            Créala gratis
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
