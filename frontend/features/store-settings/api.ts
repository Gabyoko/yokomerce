import { apiFetch } from "@/shared/api/client";
import type { CreateStoreInput, DeliveryZone, Store, UpdateStoreInput, ZoneInput } from "@/shared/types";

/** GET /public/slugs/:slug — si el link de la tienda está libre (registro). */
export function checkSlug(slug: string): Promise<{ available: boolean }> {
  return apiFetch<{ available: boolean }>(`/public/slugs/${encodeURIComponent(slug)}`);
}

/** GET /me/store */
export function getMyStore(): Promise<Store> {
  return apiFetch<Store>("/me/store");
}

/** POST /me/store — registro. */
export function createStore(input: CreateStoreInput): Promise<Store> {
  return apiFetch<Store>("/me/store", { method: "POST", body: JSON.stringify(input) });
}

/** PATCH /me/store — solo los campos que cambian. */
export function updateStore(patch: UpdateStoreInput): Promise<Store> {
  return apiFetch<Store>("/me/store", { method: "PATCH", body: JSON.stringify(patch) });
}

/** GET /me/zones — también las desactivadas. */
export function listZones(): Promise<DeliveryZone[]> {
  return apiFetch<DeliveryZone[]>("/me/zones");
}

/** PUT /me/zones — la lista completa. */
export function saveZones(zones: ZoneInput[]): Promise<DeliveryZone[]> {
  return apiFetch<DeliveryZone[]>("/me/zones", { method: "PUT", body: JSON.stringify(zones) });
}
