import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/shared/lib/brand";

/**
 * Marco de la tienda pública (va en app/[slug]/layout.tsx).
 * Deja espacio abajo en celular para la barra fija del carrito.
 * `footer`: normalmente <StoreBranding /> ("Hecho con …"), que el plan Pro oculta.
 */
export function StoreShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:px-8 lg:pt-8">{children}</div>
      <footer className="px-4 pt-8 pb-32 text-center text-[13px] text-ink-muted lg:pb-8">{footer}</footer>
    </div>
  );
}

/** "Hecho con yokomerce." al pie de la tienda. */
export function MadeWith() {
  return (
    <>
      Hecho con{" "}
      <Link
        href="/"
        className="font-display font-bold text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {BRAND.logo}
        <span className="text-primary">.</span>
      </Link>
    </>
  );
}

type StoreColumnsProps = {
  children: ReactNode;
  /** Columna derecha en computadora: carrito en el catálogo, resumen en el checkout. */
  aside: ReactNode;
  /** Si es false, la columna también se muestra en celular, debajo del contenido. */
  hideAsideOnMobile?: boolean;
};

/** Contenido a la izquierda y columna fija a la derecha desde lg (1024 px). */
export function StoreColumns({ children, aside, hideAsideOnMobile = true }: StoreColumnsProps) {
  return (
    <div className="flex flex-1 flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
      <aside className={hideAsideOnMobile ? "hidden w-80 shrink-0 lg:block xl:w-96" : "w-full shrink-0 lg:w-80 xl:w-96"}>
        <div className="lg:sticky lg:top-8">{aside}</div>
      </aside>
    </div>
  );
}
