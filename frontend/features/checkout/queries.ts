import { notFound } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/shared/api/client";

import { getPublicOrder } from "./api";

/** Pedido para la página /[slug]/pedido/[token]. Un 404 de la API muestra not-found.tsx. */
export const loadPublicOrder = cache(async (slug: string, token: string) => {
  try {
    return await getPublicOrder(slug, token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});
