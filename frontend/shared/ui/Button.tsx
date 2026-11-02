import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "dark" | "whatsapp" | "danger" | "ghost";
export type ButtonSize = "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-ink hover:border-border-strong hover:bg-bg",
  dark: "bg-ink text-white hover:bg-ink/90",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp/90",
  danger: "bg-danger text-white hover:bg-danger/90",
  ghost: "text-ink hover:bg-primary-soft",
};

const sizeStyles: Record<ButtonSize, { text: string; icon: string }> = {
  md: { text: "h-11 px-4 text-sm font-semibold [&_svg]:size-[18px]", icon: "size-11 [&_svg]:size-5" },
  lg: { text: "h-13.5 px-5 text-base font-bold [&_svg]:size-5", icon: "size-13.5 [&_svg]:size-[22px]" },
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Clases del botón. Úsalas también en enlaces que se ven como botón:
 * <Link href="/carrito" className={buttonStyles({ variant: "dark" })}>
 */
export function buttonStyles({
  variant = "primary",
  size = "md",
  iconOnly = false,
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-control whitespace-nowrap no-underline",
    "transition-colors select-none [&_svg]:shrink-0",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variantStyles[variant],
    iconOnly ? sizeStyles[size].icon : sizeStyles[size].text,
    fullWidth && "w-full",
    className,
  );
}

type BaseButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Muestra un indicador y bloquea el botón mientras se envía algo. */
  loading?: boolean;
};

/** Un botón solo con icono necesita aria-label para que se entienda qué hace. */
type ButtonProps = BaseButtonProps &
  ({ iconOnly: true; "aria-label": string } | { iconOnly?: false; "aria-label"?: string });

export function Button({
  variant,
  size,
  iconOnly,
  fullWidth,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, iconOnly, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin" />
          {iconOnly ? <span className="sr-only">Cargando</span> : children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
