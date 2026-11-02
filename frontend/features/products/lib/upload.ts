import { compressImage } from "@/shared/lib/image";

import { uploadImage } from "../api";

const MAX_BYTES = 5 * 1024 * 1024;

export class PhotoError extends Error {}

/** Comprime (máx. 1200 px, WebP) y sube una foto. Devuelve su URL. */
export async function uploadPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new PhotoError("Elige una imagen (JPG, PNG o WebP).");
  const image = await compressImage(file);
  if (image.size > MAX_BYTES) throw new PhotoError("La imagen pesa más de 5 MB.");
  const { url } = await uploadImage(image, image === file ? file.name : "foto.webp");
  return url;
}

export const photoErrorMessage = (error: unknown) =>
  error instanceof PhotoError ? error.message : "No pudimos subir la imagen. Inténtalo otra vez.";
