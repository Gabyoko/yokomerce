import { PackageX } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/shared/ui";

export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <PackageX aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">No encontramos este producto</h1>
      <p className="max-w-sm text-ink-muted">Puede que lo hayas borrado o que sea de otra tienda.</p>
      <Link href="/panel/productos" className={buttonStyles({ variant: "secondary" })}>
        Ver mis productos
      </Link>
    </div>
  );
}
