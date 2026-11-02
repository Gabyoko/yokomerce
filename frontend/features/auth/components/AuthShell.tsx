import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/shared/lib/brand";

type AuthShellProps = {
  /** "Paso 2 de 3" a la derecha del logo. */
  step?: { current: number; total: number };
  children: ReactNode;
};

/** Marco de registro e ingreso: logo arriba y una columna angosta centrada (design/Registro.dc.html). */
export function AuthShell({ step, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-5 pb-10 sm:pt-10">
        <header className="flex flex-col gap-3 pb-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="font-display text-2xl font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              {BRAND.logo}<span className="text-primary">.</span>
            </Link>
            {step && (
              <span className="text-[13px] font-semibold text-ink-muted">
                Paso {step.current} de {step.total}
              </span>
            )}
          </div>
          {step && (
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: step.total }, (_, n) => (
                <span key={n} className={n < step.current ? "h-1 flex-1 rounded-full bg-primary" : "h-1 flex-1 rounded-full bg-border"} />
              ))}
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
