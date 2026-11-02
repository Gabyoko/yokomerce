import { canUse } from "@/features/plans";
import { MadeWith } from "@/shared/ui/layout";

import { loadCatalog } from "../queries";

/** Pie "Hecho con …" de la tienda: el plan Pro lo oculta (SPEC.md, sección 10). Va dentro de un Suspense. */
export async function StoreBranding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Si la tienda no existe o falla la API, la página ya muestra su propio mensaje
  const store = await loadCatalog(slug).then(
    (catalog) => catalog.store,
    () => null,
  );
  if (!store || canUse(store, "hideBranding")) return null;
  return <MadeWith />;
}
