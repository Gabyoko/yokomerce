import { BRAND } from "@/shared/lib/brand";

/*
 * Respuesta a "¿Tus productos tienen variantes como talla, color o tamaño?" del registro.
 * No es parte del contrato: solo decide si al crear productos se muestra la ayuda de opciones,
 * así que se guarda en el navegador (dentro de try/catch).
 */
const KEY = `${BRAND.storagePrefix}:ayuda-opciones`;

export function saveOptionsHelp(show: boolean) {
  try {
    window.localStorage.setItem(KEY, show ? "1" : "0");
  } catch {
    // Sin localStorage la ayuda simplemente no se muestra
  }
}

export function shouldShowOptionsHelp(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
