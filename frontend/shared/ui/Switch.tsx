"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type SwitchProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Controlado: pasa checked y onCheckedChange. No controlado: usa defaultChecked. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Para enviarlo en un <form>: agrega un input oculto con "on" u "off". */
  name?: string;
  id?: string;
  className?: string;
};

export function Switch({
  label,
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  name,
  id,
  className,
}: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isOn = checked ?? internalChecked;

  function toggle() {
    const next = !isOn;
    if (checked === undefined) setInternalChecked(next);
    onCheckedChange?.(next);
  }

  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={switchId}
          className={cn("text-[15px] font-semibold", disabled ? "text-ink-muted" : "cursor-pointer")}
        >
          {label}
        </label>
        {description && (
          <p id={`${switchId}-description`} className="text-[13px] text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={isOn}
        aria-describedby={description ? `${switchId}-description` : undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          // El área táctil es de 44 px aunque el riel se vea más pequeño
          "group relative flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center",
          "rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-7 w-12 rounded-full transition-colors",
            isOn ? "bg-primary group-hover:bg-primary-hover" : "bg-ink-muted",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-2 size-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
            isOn && "translate-x-5",
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={isOn ? "on" : "off"} />}
    </div>
  );
}
