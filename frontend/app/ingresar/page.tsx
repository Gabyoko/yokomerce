import type { Metadata } from "next";

import { LoginForm } from "@/features/auth";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = { title: pageTitle("Ingresa"), robots: { index: false } };

export default function LoginPage() {
  return <LoginForm />;
}
