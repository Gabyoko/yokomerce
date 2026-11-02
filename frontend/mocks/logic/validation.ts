import { badRequest } from "./errors";

/** Junta errores por campo y los lanza todos juntos como 400 { error: "validation", message, fields }. */
export class FieldErrors {
  readonly fields: Record<string, string> = {};

  add(field: string, message: string) {
    this.fields[field] ??= message;
  }

  get empty() {
    return Object.keys(this.fields).length === 0;
  }

  throwIfAny(message = "Revisa los datos.") {
    if (!this.empty) throw badRequest(message, { fields: this.fields });
  }
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Texto sin espacios a los lados; "" si no es texto. */
export const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
