import { apiFetch } from "@/shared/api/client";
import type { Category, CategoryInput, ProductAdmin, ProductInput } from "@/shared/types";

/** GET /me/categories */
export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/me/categories");
}

/** PUT /me/categories — la lista completa en orden. */
export function saveCategories(categories: CategoryInput[]): Promise<Category[]> {
  return apiFetch<Category[]>("/me/categories", { method: "PUT", body: JSON.stringify(categories) });
}

/** GET /me/products — todos, también los ocultos. */
export function listProducts(): Promise<ProductAdmin[]> {
  return apiFetch<ProductAdmin[]>("/me/products");
}

/** GET /me/products/:id */
export function getProductAdmin(id: string): Promise<ProductAdmin> {
  return apiFetch<ProductAdmin>(`/me/products/${encodeURIComponent(id)}`);
}

/** POST /me/products */
export function createProduct(input: ProductInput): Promise<ProductAdmin> {
  return apiFetch<ProductAdmin>("/me/products", { method: "POST", body: JSON.stringify(input) });
}

/** PUT /me/products/:id */
export function updateProduct(id: string, input: ProductInput): Promise<ProductAdmin> {
  return apiFetch<ProductAdmin>(`/me/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
}

/** PATCH /me/products/:id — mostrar u ocultar en la tienda. */
export function setProductVisible(id: string, visible: boolean): Promise<ProductAdmin> {
  return apiFetch<ProductAdmin>(`/me/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ visible }),
  });
}

/** POST /me/uploads — sube una foto (ya comprimida en el navegador) y devuelve su URL. */
export function uploadImage(file: Blob, filename = "foto.webp"): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file, filename);
  return apiFetch<{ url: string }>("/me/uploads", { method: "POST", body: form });
}
