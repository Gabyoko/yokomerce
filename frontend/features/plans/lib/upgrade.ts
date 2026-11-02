import { BRAND } from "@/shared/lib/brand";
import { toWhatsAppNumber } from "@/shared/lib/phone";

/** Link para pedir el plan Pro por WhatsApp (el cobro inicial es manual); null si no hay número configurado. */
export function upgradeUrl(storeName: string): string | null {
  const number = toWhatsAppNumber(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "");
  if (!number) return null;
  const text = `Hola, quiero el plan Pro de ${BRAND.name} para mi tienda ${storeName}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
