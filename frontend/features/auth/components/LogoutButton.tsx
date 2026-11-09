"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SUPABASE } from "@/shared/lib/supabase";
import { Button, useToast } from "@/shared/ui";

import { signOut } from "../api";

/** Cierra la sesión del dueño y vuelve a /ingresar. Sin Supabase (fase F) no se muestra. */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  if (!SUPABASE) return null;

  async function logout() {
    setPending(true);
    try {
      await signOut();
    } catch {
      setPending(false);
      toast({ tone: "error", title: "No pudimos cerrar tu sesión", description: "Revisa tu conexión e inténtalo otra vez." });
      return;
    }
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <Button variant="ghost" fullWidth loading={pending} onClick={logout} className={className}>
      <LogOut aria-hidden />
      Cerrar sesión
    </Button>
  );
}
