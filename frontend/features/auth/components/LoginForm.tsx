"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button, buttonStyles, Input } from "@/shared/ui";

import { AuthShell } from "./AuthShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ingreso del dueño con link mágico al correo.
 * Fase F: solo simula el flujo; la sesión es la cookie de prueba (SPEC.md, sección 5).
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Escribe un correo válido, por ejemplo ana@gmail.com.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <span className="flex size-18 items-center justify-center rounded-full bg-whatsapp-soft text-whatsapp">
            <MailCheck aria-hidden size={34} />
          </span>
          <h1 className="font-display text-[26px] font-bold tracking-tight">Revisa tu correo</h1>
          <p className="text-[15px] text-ink-muted">
            Te enviamos un link a <span className="font-semibold text-ink">{email.trim()}</span> para entrar a tu panel.
          </p>
          <p className="rounded-control border border-dashed border-border-strong px-3 py-2 text-[13px] text-ink-muted">
            Versión de prueba: no se envía ningún correo. Entra directo con el botón.
          </p>
          <Link href="/panel/configuracion" className={buttonStyles({ size: "lg", fullWidth: true, className: "mt-3 rounded-[16px]" })}>
            Entrar a mi panel
          </Link>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Usar otro correo
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Ingresa a tu tienda</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Te enviamos un link a tu correo. Sin contraseñas.</p>
        </div>
        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ana@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
        <Button type="submit" size="lg" fullWidth className="rounded-[16px]">
          Enviarme el link
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
