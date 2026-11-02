import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { Field, fieldControlStyles, fieldDescribedBy } from "./Field";

type InputProps = Omit<ComponentProps<"input">, "children"> & {
  label: ReactNode;
  /** Oculta la etiqueta a la vista pero la deja para lectores de pantalla (ej. buscador). */
  hideLabel?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Icono a la izquierda (ej. <Search />). */
  icon?: ReactNode;
  wrapperClassName?: string;
};

export function Input({
  label,
  hideLabel,
  optional,
  hint,
  error,
  icon,
  id,
  className,
  wrapperClassName,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <Field
      id={inputId}
      label={<span className={cn(hideLabel && "sr-only")}>{label}</span>}
      optional={optional && !hideLabel}
      hint={hint}
      error={error}
      className={cn(hideLabel && "gap-0", wrapperClassName)}
    >
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted [&>svg]:size-[18px]"
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(inputId, hint, error)}
          className={cn(fieldControlStyles(Boolean(error)), "h-12 pr-3.5", icon != null ? "pl-10" : "pl-3.5", className)}
          {...props}
        />
      </div>
    </Field>
  );
}
