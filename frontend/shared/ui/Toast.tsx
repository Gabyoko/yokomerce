"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export type ToastTone = "success" | "error" | "info";

type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = ToastOptions & { id: number; tone: ToastTone };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 6000 };
const MAX_VISIBLE = 3;

const toneStyles: Record<ToastTone, { icon: typeof Info; color: string }> = {
  success: { icon: CircleCheck, color: "text-whatsapp" },
  error: { icon: CircleAlert, color: "text-danger" },
  info: { icon: Info, color: "text-primary" },
};

/** Va una sola vez en el layout raíz. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...options, id, tone: options.tone ?? "info" }].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* La región existe siempre para que los lectores de pantalla anuncien cada aviso */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { icon: Icon, color } = toneStyles[item.tone];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), DURATION_MS[item.tone]);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-control border border-border bg-surface py-3 pr-2 pl-4 shadow-lg"
    >
      <Icon aria-hidden size={20} className={cn("mt-0.5 shrink-0", color)} />
      <div className="flex flex-1 flex-col gap-0.5 py-0.5">
        <p className="text-[15px] font-semibold">{item.title}</p>
        {item.description && <p className="text-[13px] text-ink-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => onDismiss(item.id)}
        className="-my-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field text-ink-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <X aria-hidden size={18} />
      </button>
    </div>
  );
}

/** const { toast } = useToast(); toast({ title: "Pedido guardado", tone: "success" }) */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return context;
}
