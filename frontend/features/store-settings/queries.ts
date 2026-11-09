import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/shared/api/client";

import { getMyStore, listZones } from "./api";

/**
 * Tienda del dueño para componentes de servidor; una sola petición por render.
 * Sin sesión lleva a /ingresar; con sesión pero sin tienda (registro a medias), a /registro.
 */
export const loadMyStore = cache(async () => {
  try {
    return await getMyStore();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/ingresar");
    if (error instanceof ApiError && error.code === "no_store") redirect("/registro");
    throw error;
  }
});

export const loadMyZones = cache(() => listZones());
