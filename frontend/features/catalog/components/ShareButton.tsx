"use client";

import { Link2 } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useToast } from "@/shared/ui";

/** Comparte el link con el menú del celular; en computadora lo copia. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const { toast } = useToast();

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // El usuario cerró el menú de compartir
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiamos el link", description: "Pégalo donde quieras compartirlo.", tone: "success" });
    } catch {
      toast({ title: "No pudimos copiar el link", description: url, tone: "error" });
    }
  }

  return (
    <button
      type="button"
      aria-label="Compartir producto"
      onClick={share}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <Link2 aria-hidden size={18} />
    </button>
  );
}
