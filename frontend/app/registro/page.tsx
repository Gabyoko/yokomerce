import type { Metadata } from "next";

import { RegisterFlow } from "@/features/auth";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Crea tu tienda"),
  description: "Crea gratis el catálogo de tu negocio y recibe pedidos ordenados por WhatsApp.",
};

export default function RegisterPage() {
  return <RegisterFlow />;
}
