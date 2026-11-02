"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Acciones fijas abajo (ej. Cancelar / Guardar). */
  footer?: ReactNode;
  className?: string;
};

/**
 * En el celular sale desde abajo como hoja; desde 640 px se muestra centrado.
 * Se cierra con Esc, tocando afuera o con la X.
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Evita que la página de atrás se desplace mientras el modal está abierto
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: dejamos que el estado del padre decida
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clic en el fondo oscuro (fuera del contenido)
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-full overflow-hidden border-0 bg-surface p-0 text-ink",
        "rounded-t-sheet open:flex open:animate-sheet-up open:flex-col",
        "sm:m-auto sm:max-w-lg sm:rounded-sheet sm:open:animate-fade-in",
        "backdrop:animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
        <div className="flex flex-col gap-1 pt-2">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-sm text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <Button variant="ghost" iconOnly aria-label="Cerrar" onClick={onClose} className="-mr-2">
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </div>
      )}
    </dialog>
  );
}
