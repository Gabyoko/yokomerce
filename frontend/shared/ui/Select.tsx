import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { Field, fieldControlStyles, fieldDescribedBy } from "./Field";

type SelectProps = ComponentProps<"select"> & {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Primera opción vacía (ej. "Elige una zona"). */
  placeholder?: string;
  wrapperClassName?: string;
};

/** Select nativo: en el celular abre el selector del sistema. */
export function Select({
  label,
  optional,
  hint,
  error,
  placeholder,
  id,
  className,
  wrapperClassName,
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <Field
      id={selectId}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(selectId, hint, error)}
          className={cn(
            fieldControlStyles(Boolean(error)),
            "h-12 cursor-pointer appearance-none pr-10 pl-3.5",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown
          aria-hidden
          size={18}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </Field>
  );
}
