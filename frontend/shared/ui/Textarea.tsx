import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { Field, fieldControlStyles, fieldDescribedBy } from "./Field";

type TextareaProps = Omit<ComponentProps<"textarea">, "children"> & {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
};

export function Textarea({
  label,
  optional,
  hint,
  error,
  id,
  rows = 3,
  className,
  wrapperClassName,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <Field
      id={textareaId}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(textareaId, hint, error)}
        className={cn(
          fieldControlStyles(Boolean(error)),
          "min-h-24 resize-y px-3.5 py-3 leading-relaxed",
          className,
        )}
        {...props}
      />
    </Field>
  );
}
