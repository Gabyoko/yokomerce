import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type PlaceholderPageProps = {
  title: string;
  /** Etapa de SPEC.md donde se construye, ej. "F3". */
  stage: string;
  /** Margen lateral en celular: la tienda no lo trae (su portada va de borde a borde), el panel sí. */
  inset?: boolean;
  children?: ReactNode;
};

/** Página vacía temporal. Se reemplaza al construir cada pantalla. */
export function PlaceholderPage({ title, stage, inset = false, children }: PlaceholderPageProps) {
  return (
    <div className={cn("flex flex-col gap-2", inset && "px-4 pt-6 lg:px-0 lg:pt-0")}>
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
      <p className="text-[15px] text-ink-muted">Esta pantalla se construye en la etapa {stage}.</p>
      {children}
    </div>
  );
}
