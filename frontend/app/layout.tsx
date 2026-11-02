import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { BRAND } from "@/shared/lib/brand";
import { ToastProvider } from "@/shared/ui";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: "Tu catálogo con link propio y pedidos ordenados por WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-PE" className={`${bricolage.variable} ${figtree.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
