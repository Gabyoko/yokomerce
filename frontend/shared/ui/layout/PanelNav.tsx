"use client";

import { Gem, type LucideIcon, Package, ReceiptText, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { cn } from "@/shared/lib/cn";

type NavItem = {
  href: string;
  /** Texto en el menú lateral (computadora). */
  label: string;
  /** Texto corto en el menú inferior (celular). */
  shortLabel: string;
  icon: LucideIcon;
  /** Plan va en la tarjeta del menú lateral, no en la lista. */
  sidebar: boolean;
};

const items: NavItem[] = [
  { href: "/panel", label: "Pedidos", shortLabel: "Pedidos", icon: ReceiptText, sidebar: true },
  { href: "/panel/productos", label: "Productos e inventario", shortLabel: "Productos", icon: Package, sidebar: true },
  { href: "/panel/configuracion", label: "Mi tienda", shortLabel: "Mi tienda", icon: Store, sidebar: true },
  { href: "/panel/plan", label: "Plan", shortLabel: "Plan", icon: Gem, sidebar: false },
];

/** "/panel" solo está activo en sí mismo y en el detalle de pedidos. */
function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  if (href === "/panel") return pathname === "/panel" || pathname.startsWith("/panel/pedidos");
  return pathname === href || pathname.startsWith(`${href}/`);
}

type PanelNavProps = {
  variant: "sidebar" | "bottom";
  /** Contador de pedidos nuevos junto a "Pedidos" (puede cargar con Suspense). */
  ordersBadge?: ReactNode;
};

/**
 * En rutas con parámetros (ej. /panel/pedidos/[id]) la ruta actual no se conoce al prerenderizar,
 * así que mientras tanto se muestra el menú sin sección marcada.
 */
export function PanelNav(props: PanelNavProps) {
  return (
    <Suspense fallback={<PanelNavLinks {...props} pathname={null} />}>
      <PanelNavWithPathname {...props} />
    </Suspense>
  );
}

function PanelNavWithPathname(props: PanelNavProps) {
  const pathname = usePathname();
  return <PanelNavLinks {...props} pathname={pathname} />;
}

function PanelNavLinks({
  variant,
  ordersBadge,
  pathname,
}: PanelNavProps & { pathname: string | null }) {
  if (variant === "sidebar") {
    return (
      <nav aria-label="Secciones del panel" className="flex flex-col gap-1">
        {items
          .filter((item) => item.sidebar)
          .map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-field px-3 text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-primary",
                  active ? "bg-primary-soft font-bold text-primary-hover" : "font-semibold text-ink hover:bg-bg",
                )}
              >
                <Icon aria-hidden size={18} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/panel" && ordersBadge}
              </Link>
            );
          })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-2 pb-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-field px-2 text-xs",
                  "focus-visible:outline-2 focus-visible:outline-primary",
                  active ? "font-bold text-primary" : "font-semibold text-ink-muted hover:text-ink",
                )}
              >
                <Icon aria-hidden size={22} />
                {item.shortLabel}
                {item.href === "/panel" && ordersBadge}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
