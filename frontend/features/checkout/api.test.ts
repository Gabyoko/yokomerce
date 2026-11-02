import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateOrderInput } from "@/shared/types";

import { createOrder, getPublicOrder } from "./api";

const fetchMock = vi.fn();
const input = { storeSlug: "dulcesdeana" } as CreateOrderInput;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("createOrder", () => {
  it("envía el pedido por POST y devuelve el éxito", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, order: { number: 43 } }, { status: 201 }));
    await expect(createOrder(input)).resolves.toEqual({ ok: true, order: { number: 43 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/public/orders");
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify(input) });
  });

  it("out_of_stock (409) se devuelve como resultado, sin el mensaje", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ok: false, error: "out_of_stock", message: "Sin stock", items: [{ variantId: "v1", available: 1 }] }, { status: 409 }),
    );
    await expect(createOrder(input)).resolves.toEqual({ ok: false, error: "out_of_stock", items: [{ variantId: "v1", available: 1 }] });
  });

  it("validation (400) devuelve los campos", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ok: false, error: "validation", message: "Revisa", fields: { "customer.phone": "Inválido" } }, { status: 400 }),
    );
    await expect(createOrder(input)).resolves.toEqual({ ok: false, error: "validation", fields: { "customer.phone": "Inválido" } });
  });

  it("rate_limited (429)", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: "rate_limited", message: "Espera" }, { status: 429 }));
    await expect(createOrder(input)).resolves.toEqual({ ok: false, error: "rate_limited" });
  });

  it("otros errores se lanzan", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "not_found", message: "No existe" }, { status: 404 }));
    await expect(createOrder(input)).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});

describe("getPublicOrder", () => {
  it("codifica slug y token en la URL", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await getPublicOrder("mi tienda", "a/b");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/public/stores/mi%20tienda/orders/a%2Fb");
  });
});
