import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { Field, fieldControlStyles, fieldDescribedBy } from "./Field";

type PhoneInputProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
};

/** Celular peruano con el prefijo +51 al lado (checkout, registro, configuración). */
export function PhoneInput({ label, hint, error, id, className, wrapperClassName, ...props }: PhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="flex gap-2">
        <span
          aria-hidden
          className="flex h-12 items-center rounded-field border border-border bg-surface px-3 text-[15px] font-semibold"
        >
          +51
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="987 654 321"
          maxLength={15}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(inputId, hint, error)}
          className={cn(fieldControlStyles(Boolean(error)), "h-12 min-w-0 flex-1 px-3.5", className)}
          {...props}
        />
      </div>
    </Field>
  );
}
