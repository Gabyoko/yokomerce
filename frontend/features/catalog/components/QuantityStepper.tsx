"use client";

import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/** − 2 + con botones de 44 px. */
export function QuantityStepper({ value, max, onChange, disabled }: QuantityStepperProps) {
  const button =
    "flex h-13 w-11 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-border-strong focus-visible:outline-2 focus-visible:outline-primary rounded-control";
  return (
    <div className="flex shrink-0 items-center rounded-control border border-border bg-surface" role="group" aria-label="Cantidad">
      <button type="button" aria-label="Quitar uno" className={button} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden size={18} />
      </button>
      <span aria-live="polite" className="w-7 text-center text-[17px] font-bold">
        {value}
      </span>
      <button type="button" aria-label="Agregar uno" className={button} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden size={18} />
      </button>
    </div>
  );
}
