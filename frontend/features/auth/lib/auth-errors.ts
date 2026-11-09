/** Mensajes en español para los errores de Supabase Auth. Recibe solo lo que importa del error. */
export type AuthErrorLike = { code?: string; status?: number; name?: string };

export const PASSWORD_MIN = 8;

export class AuthFailure extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthFailure";
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  email_not_confirmed: "Primero confirma tu correo con el link que te enviamos.",
  weak_password: `Tu contraseña es muy débil. Usa al menos ${PASSWORD_MIN} caracteres, con letras y números.`,
  email_address_invalid: "Escribe un correo válido, por ejemplo ana@gmail.com.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  email_provider_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  user_banned: "Esta cuenta está suspendida.",
  over_request_rate_limit: "Hiciste muchos intentos. Espera un minuto y vuelve a probar.",
  over_email_send_rate_limit: "Hiciste muchos intentos. Espera un minuto y vuelve a probar.",
};

export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  if (error.status === 429) return MESSAGES.over_request_rate_limit!;
  // Sin respuesta del servidor (sin internet o Supabase caído)
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "Revisa tu conexión a internet e inténtalo otra vez.";
  return "Algo salió mal. Inténtalo otra vez.";
}

/** La cuenta ya existe: en el registro se prueba entrar con la misma contraseña. */
export function isExistingAccount(error: AuthErrorLike): boolean {
  return error.code === "user_already_exists" || error.code === "email_exists";
}

/** A dónde ir después de ingresar. Solo rutas del panel, para que nadie use el link para mandarte a otro sitio. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/panel") || next.startsWith("//") || next.includes("\\")) return "/panel";
  return next;
}
