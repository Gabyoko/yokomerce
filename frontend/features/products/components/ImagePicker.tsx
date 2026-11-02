"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { Button, useToast } from "@/shared/ui";

import { photoErrorMessage, uploadPhoto } from "../lib/upload";

type ImagePickerProps = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Logo cuadrado o portada ancha. */
  shape: "square" | "wide";
};

/** Elegir, comprimir y subir una sola foto (logo, portada, guía de tallas). */
export function ImagePicker({ label, hint, value, onChange, shape }: ImagePickerProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadPhoto(file));
    } catch (error) {
      toast({ tone: "error", title: photoErrorMessage(error) });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-[15px] font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={uploading}
          onClick={() => input.current?.click()}
          className={cn(
            "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border-strong bg-bg text-ink-muted",
            "hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            shape === "square" ? "size-20 rounded-[20px]" : "h-20 w-36 rounded-control",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <Camera aria-hidden size={24} />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/80 text-primary">
              <LoaderCircle aria-hidden className="animate-spin" size={22} />
              <span className="sr-only">Subiendo</span>
            </span>
          )}
        </button>
        <div className="flex flex-col items-start gap-1">
          <Button variant="secondary" disabled={uploading} onClick={() => input.current?.click()}>
            {value ? "Cambiar" : "Subir foto"}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-sm font-semibold text-danger hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Trash2 aria-hidden size={16} />
              Quitar
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
