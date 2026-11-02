"use client";

import { useState } from "react";

import { cn } from "@/shared/lib/cn";

import { ProductImage } from "./ProductImage";

/** Fotos del producto: se deslizan con el dedo en el celular; los puntos marcan cuál se ve. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);

  if (images.length <= 1) {
    return <ProductImage src={images[0]} alt={name} iconSize={48} priority className="h-full w-full" />;
  }

  return (
    <div className="relative h-full">
      <div
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const el = event.currentTarget;
          setCurrent(Math.round(el.scrollLeft / el.clientWidth));
        }}
        aria-label={`Fotos de ${name}`}
        role="region"
        tabIndex={0}
      >
        {images.map((src, index) => (
          <div key={src} className="h-full w-full shrink-0 snap-center">
            <ProductImage src={src} alt={`${name}, foto ${index + 1} de ${images.length}`} priority={index === 0} className="h-full w-full" />
          </div>
        ))}
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-9 flex justify-center gap-1.5 lg:bottom-4">
        {images.map((src, index) => (
          <span key={src} className={cn("h-1.5 rounded-full transition-all", index === current ? "w-4.5 bg-ink" : "w-1.5 bg-white")} />
        ))}
      </div>
    </div>
  );
}
