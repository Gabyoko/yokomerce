"use client";

import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { useToast } from "@/shared/ui";

import { photoErrorMessage, uploadPhoto } from "../lib/upload";
import { PRODUCT_LIMITS } from "../lib/product-form";

type ProductImagesFieldProps = {
  images: string[];
  onChange: (images: string[]) => void;
  error?: string;
};

const iconButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface/95 after:absolute after:-inset-1.5 after:content-[''] text-ink shadow-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:hidden";

/** Hasta 5 fotos: se comprimen antes de subir; la primera es la principal. */
export function ProductImagesField({ images, onChange, error }: ProductImagesFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const { toast } = useToast();
  const free = PRODUCT_LIMITS.images - images.length - uploading;

  async function handleFiles(files: FileList | null) {
    const chosen = Array.from(files ?? []).slice(0, Math.max(free, 0));
    if (input.current) input.current.value = "";
    if (chosen.length === 0) return;
    setUploading((n) => n + chosen.length);
    const urls: string[] = [];
    for (const file of chosen) {
      try {
        urls.push(await uploadPhoto(file));
      } catch (e) {
        toast({ tone: "error", title: photoErrorMessage(e) });
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (urls.length > 0) onChange([...images, ...urls].slice(0, PRODUCT_LIMITS.images));
  }

  function move(index: number, delta: number) {
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(index + delta, 0, item);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2" data-error={error ? true : undefined}>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">Fotos</span>
        <span className="text-[13px] text-ink-muted">
          {images.length} de {PRODUCT_LIMITS.images}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {images.map((url, index) => (
          <li key={url} className="relative aspect-square overflow-hidden rounded-control border border-border bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Foto ${index + 1}`} className="size-full object-cover" />
            {index === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                Principal
              </span>
            )}
            <button type="button" aria-label={`Quitar foto ${index + 1}`} className={cn(iconButton, "absolute top-1.5 right-1.5")} onClick={() => onChange(images.filter((_, i) => i !== index))}>
              <X aria-hidden size={16} />
            </button>
            <div className="absolute right-1.5 bottom-1.5 flex gap-1">
              <button type="button" aria-label={`Mover foto ${index + 1} a la izquierda`} disabled={index === 0} className={cn(iconButton, "relative")} onClick={() => move(index, -1)}>
                <ChevronLeft aria-hidden size={16} />
              </button>
              <button
                type="button"
                aria-label={`Mover foto ${index + 1} a la derecha`}
                disabled={index === images.length - 1}
                className={cn(iconButton, "relative")}
                onClick={() => move(index, 1)}
              >
                <ChevronRight aria-hidden size={16} />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, n) => (
          <li key={`subiendo-${n}`} className="flex aspect-square items-center justify-center rounded-control border border-border bg-bg text-primary">
            <LoaderCircle aria-hidden className="animate-spin" size={22} />
            <span className="sr-only">Subiendo foto</span>
          </li>
        ))}
        {free > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-dashed border-border-strong bg-surface text-[13px] font-semibold text-ink-muted hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ImagePlus aria-hidden size={24} />
              Agregar
            </button>
          </li>
        )}
      </ul>
      <p className="text-[13px] text-ink-muted">La primera es la que se ve en el catálogo. Las achicamos para que carguen rápido.</p>
      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
