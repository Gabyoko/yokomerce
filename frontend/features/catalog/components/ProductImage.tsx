import { ImageIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

type ProductImageProps = {
  src: string | undefined;
  alt: string;
  muted?: boolean;
  iconSize?: number;
  className?: string;
  /** La primera foto visible de la página se carga sin esperar. */
  priority?: boolean;
};

/** Foto cuadrada del producto o, si no tiene, el ícono de imagen del diseño. */
export function ProductImage({ src, alt, muted = false, iconSize = 28, className, priority = false }: ProductImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-square items-center justify-center",
          muted ? "bg-bg text-ink-muted" : "bg-primary-soft text-primary-hover",
          className,
        )}
      >
        <ImageIcon aria-hidden size={iconSize} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    // Las fotos vienen de cualquier dominio (subidas por el dueño): <img> simple, sin optimizador
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("aspect-square w-full bg-primary-soft object-cover", muted && "opacity-60 grayscale", className)}
    />
  );
}
