import { describe, expect, it } from "vitest";

import { authErrorMessage, isExistingAccount, safeNextPath } from "./auth-errors";

describe("authErrorMessage", () => {
  it("traduce los códigos conocidos", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("El correo o la contraseña no son correctos.");
    expect(authErrorMessage({ code: "weak_password" })).toContain("8 caracteres");
  });

  it("muchos intentos, aunque no traiga código", () => {
    expect(authErrorMessage({ status: 429 })).toContain("muchos intentos");
  });

  it("sin conexión", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError" })).toContain("conexión");
  });

  it("cualquier otro error da un mensaje general", () => {
    expect(authErrorMessage({ code: "unexpected_failure", status: 500 })).toBe("Algo salió mal. Inténtalo otra vez.");
  });
});

describe("isExistingAccount", () => {
  it("reconoce los dos códigos de cuenta repetida", () => {
    expect(isExistingAccount({ code: "user_already_exists" })).toBe(true);
    expect(isExistingAccount({ code: "email_exists" })).toBe(true);
    expect(isExistingAccount({ code: "invalid_credentials" })).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("acepta rutas del panel", () => {
    expect(safeNextPath("/panel/pedidos?estado=new")).toBe("/panel/pedidos?estado=new");
  });

  it("todo lo demás va al panel", () => {
    for (const next of [null, undefined, "", "/", "https://otro.com", "//otro.com/panel", String.raw`/panel\..\x`, "/registro"]) {
      expect(safeNextPath(next)).toBe("/panel");
    }
  });
});
