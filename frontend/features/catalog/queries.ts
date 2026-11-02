import { notFound } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/shared/api/client";

import { getCatalog, getProduct } from "./api";

/*
 * Consultas para componentes de servidor. `cache` evita pedir lo mismo dos veces en una petición
 * (la página y generateMetadata usan los mismos datos). Un 404 de la API muestra not-found.tsx.
 */

async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export const loadCatalog = cache((slug: string) => orNotFound(getCatalog(slug)));

export const loadProduct = cache((slug: string, productId: string) => orNotFound(getProduct(slug, productId)));
