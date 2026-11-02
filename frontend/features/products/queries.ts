import { notFound } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/shared/api/client";

import { getProductAdmin, listCategories, listProducts } from "./api";

/** Consultas para componentes de servidor del panel; una petición por render. */
export const loadMyProducts = cache(() => listProducts());

export const loadMyCategories = cache(() => listCategories());

export const loadMyProduct = cache(async (id: string) => {
  try {
    return await getProductAdmin(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});
