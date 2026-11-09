/*
 * Sesión del dueño con Supabase Auth: correo y contraseña (SPEC.md, sección 5, "Sesión").
 * Supabase guarda la sesión en cookies y apiFetch manda su token al back.
 * Sin Supabase configurado (fase F) no hacen nada: la sesión es la cookie de prueba.
 */
import { browserSupabase, SUPABASE } from "@/shared/lib/supabase";

import { AuthFailure, authErrorMessage, isExistingAccount } from "./lib/auth-errors";

function fail(error: { code?: string; status?: number; name?: string }): never {
  throw new AuthFailure(error.code ?? "unknown", authErrorMessage(error));
}

/** Correo de la sesión actual, o null si no hay sesión. */
export async function currentEmail(): Promise<string | null> {
  if (!SUPABASE) return null;
  const { data } = await (await browserSupabase()).auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!SUPABASE) return;
  const { error } = await (await browserSupabase()).auth.signInWithPassword({ email: email.trim(), password });
  if (error) fail(error);
}

/**
 * Registro: crea la cuenta y deja la sesión iniciada. Si el correo ya tiene cuenta (por ejemplo, un
 * registro anterior que no llegó a crear la tienda), entra con la misma contraseña.
 */
export async function createAccount(email: string, password: string): Promise<void> {
  if (!SUPABASE) return;
  const { data, error } = await (await browserSupabase()).auth.signUp({ email: email.trim(), password });
  // Con "Confirm email" activo, Supabase no avisa que el correo existe: devuelve un usuario sin identidades
  const exists = error ? isExistingAccount(error) : data.user?.identities?.length === 0;
  if (exists) {
    try {
      await signIn(email, password);
    } catch (signInError) {
      if (signInError instanceof AuthFailure && signInError.code === "invalid_credentials") {
        throw new AuthFailure("email_in_use", "Ya existe una cuenta con este correo. Si es tuya, ingresa con tu contraseña.");
      }
      throw signInError;
    }
    return;
  }
  if (error) fail(error);
  if (!data.session) {
    throw new AuthFailure("confirm_email", "Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego vuelve a tocar Crear mi tienda.");
  }
}

export async function signOut(): Promise<void> {
  if (!SUPABASE) return;
  await (await browserSupabase()).auth.signOut();
}
