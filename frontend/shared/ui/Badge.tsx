import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export type BadgeTone = "neutral" | "dark" | "primary" | "success" | "warning" | "danger";
type BadgeSize = "sm" | "md";

const toneStyles: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "border border-border bg-surface text-ink", dot: "bg-ink-muted" },
  dark: { badge: "bg-ink text-white", dot: "bg-white" },
  primary: { badge: "bg-primary text-white", dot: "bg-white" },
  success: { badge: "bg-whatsapp-soft text-whatsapp", dot: "bg-whatsapp" },
  warning: { badge: "bg-warning-soft text-warning", dot: "bg-warning" },
  danger: { badge: "bg-danger-soft text-danger", dot: "bg-danger" },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-1 text-xs font-bold",
  md: "px-2.5 py-1.5 text-[13px] font-semibold",
};

type BadgeProps = ComponentProps<"span"> & {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Punto de color a la izquierda (ej. "Abierto"). */
  dot?: boolean;
};

/** Etiqueta de estado: "Quedan 2", "Agotado", "Nuevo", "Abierto hasta 8 p. m." */
export function Badge({ tone = "neutral", size = "sm", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full leading-none whitespace-nowrap [&_svg]:size-3.5",
        toneStyles[tone].badge,
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className={cn("size-2 rounded-full", toneStyles[tone].dot)} />}
      {children}
    </span>
  );
}
