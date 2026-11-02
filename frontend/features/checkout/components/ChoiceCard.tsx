import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type ChoiceCardProps = Omit<ComponentProps<"input">, "type" | "className" | "children"> & {
  children: ReactNode;
  /** Círculo de radio a la izquierda (métodos de pago). */
  indicator?: boolean;
  className?: string;
};

/**
 * Opción tipo tarjeta: es un radio real (se navega con flechas y lo leen los lectores de pantalla),
 * con el estilo del diseño: borde terracota y fondo suave cuando está elegida.
 */
export function ChoiceCard({ children, indicator = false, className, ...input }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-control border border-border bg-surface px-3.5 py-2.5 text-ink transition-colors",
        "hover:border-border-strong",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:shadow-[inset_0_0_0_1px_var(--color-primary)]",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
        className,
      )}
    >
      <input type="radio" className="peer sr-only" {...input} />
      {indicator && (
        <span
          aria-hidden
          className="size-[18px] shrink-0 rounded-full border-2 border-border-strong bg-surface peer-checked:border-[5px] peer-checked:border-primary"
        />
      )}
      {children}
    </label>
  );
}

type ChoiceGroupProps = {
  legend: ReactNode;
  error?: string;
  /** Id para enlazar el mensaje de error. */
  errorId: string;
  className?: string;
  children: ReactNode;
};

/** Grupo de opciones con su título y mensaje de error. */
export function ChoiceGroup({ legend, error, errorId, className, children }: ChoiceGroupProps) {
  return (
    <fieldset aria-describedby={error ? errorId : undefined} data-invalid={error ? true : undefined} className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 text-[15px] font-semibold">{legend}</legend>
      <div className={className}>{children}</div>
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
