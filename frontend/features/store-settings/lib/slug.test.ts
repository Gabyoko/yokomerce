import { describe, expect, it } from "vitest";

import { cleanSlugInput, slugProblem, suggestSlug } from "./slug";

describe("suggestSlug", () => {
  it("quita espacios, tildes y símbolos", () => {
    expect(suggestSlug("Dulces de Ana")).toBe("dulcesdeana");
    expect(suggestSlug("Café Ñaña's")).toBe("cafenanas");
    expect(suggestSlug("x".repeat(40))).toHaveLength(30);
  });
});

describe("cleanSlugInput", () => {
  it("deja minúsculas, números y guiones", () => {
    expect(cleanSlugInput("Taller Norte!!")).toBe("taller-norte");
    expect(cleanSlugInput("a--b")).toBe("a-b");
  });
});

describe("slugProblem", () => {
  it("acepta un link correcto", () => expect(slugProblem("dulces-de-ana")).toBeNull());
  it("avisa si es corto, tiene guion al borde o está reservado", () => {
    expect(slugProblem("ab")).toMatch(/al menos 3/);
    expect(slugProblem("-ana")).toMatch(/guion/);
    expect(slugProblem("panel")).toMatch(/reservado/);
  });
});
