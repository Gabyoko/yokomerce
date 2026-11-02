import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** Candado de una función de Pro: no se oculta, enlaza a la página de plan (SPEC.md, sección 10). */
export function ProLock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link
      href="/panel/plan"
      className={cn(
        "flex items-center gap-2 rounded-control border border-dashed border-border-strong p-3 text-sm text-ink-muted hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
    >
      <Lock aria-hidden size={16} className="shrink-0" />
      <span>{children}</span>
    </Link>
  );
}
