/**
 * Error de la API de prueba. Se convierte en una respuesta { error, message, ...extra }
 * con el código HTTP indicado (SPEC.md, sección 5).
 */
export class MockApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MockApiError";
  }
}

export const notFound = (message = "No encontramos lo que buscas.") => new MockApiError(404, "not_found", message);

export const badRequest = (message: string, extra?: Record<string, unknown>) =>
  new MockApiError(400, "validation", message, extra);

export const conflict = (code: string, message: string, extra?: Record<string, unknown>) =>
  new MockApiError(409, code, message, extra);
