import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type FlowHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  /** Barra de pasos: "Paso 2 de 2". */
  step?: { current: number; total: number };
};

/** Encabezado del carrito y el checkout: volver, título y pasos (design/Carrito y Datos). */
export function FlowHeader({ backHref, backLabel, title, subtitle, step }: FlowHeaderProps) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-4 pb-2 lg:px-0 lg:pt-0">
      <header className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft aria-hidden size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-tight font-bold lg:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted lg:text-sm">{subtitle}</p>}
        </div>
      </header>
      {step && (
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: step.total }, (_, n) => (
            <span key={n} className={n < step.current ? "h-1 flex-1 rounded-full bg-primary" : "h-1 flex-1 rounded-full bg-border"} />
          ))}
        </div>
      )}
    </div>
  );
}
