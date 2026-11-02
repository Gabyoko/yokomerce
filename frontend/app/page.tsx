import type { Metadata } from "next";

import { Landing } from "@/features/marketing";
import { BRAND } from "@/shared/lib/brand";

const description =
  "Comparte un link con tus productos. Tus clientes arman su pedido solos y te llega por WhatsApp. Sin apps, sin comisiones.";

export const metadata: Metadata = {
  title: `${BRAND.name} · Catálogo y pedidos por WhatsApp`,
  description,
  openGraph: { title: `${BRAND.name} · Catálogo y pedidos por WhatsApp`, description, type: "website" },
};

export default function Home() {
  return <Landing />;
}
