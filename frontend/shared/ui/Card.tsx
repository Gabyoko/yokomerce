import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

type CardPadding = "none" | "sm" | "md" | "lg";

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-2",
  md: "p-4",
  lg: "p-5 sm:p-6",
};

type CardProps = ComponentProps<"div"> & {
  padding?: CardPadding;
};

/** Superficie blanca con borde. Para tarjetas de producto usa padding="sm". */
export function Card({ padding = "md", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface", paddingStyles[padding], className)}
      {...props}
    />
  );
}
