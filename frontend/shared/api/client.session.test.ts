import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sesión real (fase C): con Supabase configurado, apiFetch manda el token y no la tienda de prueba
const getSession = vi.fn();
vi.mock("@/shared/lib/supabase/config", () => ({ SUPABASE: { url: "https://x.supabase.co", key: "sb_publishable_x" } }));
vi.mock("@/shared/lib/supabase/browser", () => ({ browserClient: () => ({ auth: { getSession } }) }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "mock_store=tallernorte" });
  fetchMock.mockResolvedValue(Response.json({}));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  getSession.mockReset();
});

describe("apiFetch con sesión real", () => {
  it("envía el token de la sesión y no la cabecera de prueba", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    const { apiFetch } = await import("./client");
    await apiFetch("/me/store");
    const headers = fetchMock.mock.calls[0]![1].headers;
    expect(headers).toMatchObject({ Authorization: "Bearer token-123" });
    expect(headers).not.toHaveProperty("X-Mock-Store");
  });

  it("sin sesión no envía Authorization", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { apiFetch } = await import("./client");
    await apiFetch("/public/stores/x");
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty("Authorization");
  });
});
