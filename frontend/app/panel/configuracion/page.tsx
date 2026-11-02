import type { Metadata } from "next";

import { loadMyStore, loadMyZones, MyDevStoreSwitcher, SettingsForm } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = { title: pageTitle("Mi tienda") };

export default async function SettingsPage({ searchParams }: PageProps<"/panel/configuracion">) {
  const [{ bienvenida }, store, zones] = await Promise.all([searchParams, loadMyStore(), loadMyZones()]);
  return (
    <div className="flex flex-col gap-5">
      {/* En computadora el selector está en el menú lateral */}
      <MyDevStoreSwitcher className="mx-auto w-full max-w-3xl lg:hidden" />
      {/* key: al cambiar de tienda de prueba, el formulario empieza de nuevo */}
      <SettingsForm key={store.id} store={store} zones={zones} welcome={bienvenida === "1"} />
    </div>
  );
}
