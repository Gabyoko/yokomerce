/** Tamaño máximo de las fotos (lado más largo) y formato al subirlas (SPEC.md, sección 5). */
export const IMAGE_MAX_SIZE = 1200;
const IMAGE_TYPE = "image/webp";
const IMAGE_QUALITY = 0.82;

/** Medidas para que la imagen entre en `max` × `max` sin deformarse ni agrandarse. */
export function fitWithin(width: number, height: number, max: number = IMAGE_MAX_SIZE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Achica la foto en el navegador antes de subirla (máx. 1200 px, WebP).
 * Si el navegador no puede procesarla, devuelve el archivo original.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, IMAGE_TYPE, IMAGE_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
