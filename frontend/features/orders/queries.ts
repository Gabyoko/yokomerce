import { notFound } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/shared/api/client";

import { getOrder, listOrders } from "./api";

/** Todos los pedidos de la tienda (las pestañas y la búsqueda filtran en el navegador). */
export const loadMyOrders = cache(() => listOrders());

export const loadMyOrder = cache(async (id: string) => {
  try {
    return await getOrder(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});
