import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/shared/ui";

export default function OrderNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <SearchX aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">No encontramos este pedido</h1>
      <p className="max-w-sm text-ink-muted">Puede que sea de otra tienda o que el link esté incompleto.</p>
      <Link href="/panel" className={buttonStyles({ variant: "secondary" })}>
        Ver mis pedidos
      </Link>
    </div>
  );
}
