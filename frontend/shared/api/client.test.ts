import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api/mock");
  vi.stubGlobal("fetch", fetchMock);
  // Simula el navegador para leer la cookie con document.cookie
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "otra=1; mock_store=tallernorte" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("apiFetch", () => {
  it("llama a la URL completa con JSON, la tienda de prueba y credenciales", async () => {
    fetchMock.mockResolvedValue(Response.json({ hola: "mundo" }));
    await expect(apiFetch("/public/stores/x")).resolves.toEqual({ hola: "mundo" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/mock/public/stores/x");
    expect(init).toMatchObject({
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mock-Store": "tallernorte" },
    });
  });

  it("respeta method, body y cabeceras propias", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await apiFetch("/x", { method: "POST", body: "{}", headers: { "X-Extra": "1" } });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST", body: "{}", headers: { "X-Extra": "1" } });
  });

  it("sin cookie no envía X-Mock-Store", async () => {
    vi.stubGlobal("document", { cookie: "" });
    fetchMock.mockResolvedValue(Response.json({}));
    await apiFetch("/x");
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty("X-Mock-Store");
  });

  it("convierte { error, message } en ApiError y guarda el cuerpo", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "out_of_stock", message: "Sin stock", items: [{ variantId: "v1", available: 0 }] }, { status: 409 }),
    );
    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "out_of_stock",
      message: "Sin stock",
      body: { items: [{ variantId: "v1", available: 0 }] },
    });
  });

  it("si el error no trae JSON usa valores por defecto", async () => {
    fetchMock.mockResolvedValue(new Response("Internal", { status: 500 }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 500, code: "unknown", message: "Algo salió mal" });
  });

  it("avisa si falta NEXT_PUBLIC_API_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await expect(apiFetch("/x")).rejects.toThrow("NEXT_PUBLIC_API_URL");
  });
});
