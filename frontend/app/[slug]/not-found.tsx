import { Store } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/shared/ui";
import { BRAND } from "@/shared/lib/brand";

export default function StoreNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <Store aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">Esta tienda no existe</h1>
      <p className="max-w-sm text-ink-muted">Revisa que el link esté bien escrito o pídele a la tienda que te lo envíe de nuevo.</p>
      <Link href="/" className={buttonStyles({ variant: "secondary" })}>
        Ir a {BRAND.name}
      </Link>
    </div>
  );
}
