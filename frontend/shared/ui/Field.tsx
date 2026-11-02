import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** Clases comunes de Input, Select y Textarea. */
export const fieldControlStyles = (hasError: boolean) =>
  cn(
    "w-full rounded-field border bg-surface text-[15px] text-ink placeholder:text-ink-muted",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
    "disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-muted",
    hasError ? "border-danger" : "border-border hover:border-border-strong",
  );

/** Ids de ayuda y error para conectar el control con aria-describedby. */
export function fieldDescribedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  // El texto de ayuda se oculta cuando hay error (ver Field)
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

type FieldProps = {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Envoltorio con etiqueta, texto de ayuda y mensaje de error. */
export function Field({ id, label, optional, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
        {optional && <span className="font-medium text-ink-muted"> (opcional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <CircleAlert aria-hidden size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
