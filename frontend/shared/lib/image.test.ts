import { describe, expect, it } from "vitest";

import { fitWithin } from "./image";

describe("fitWithin", () => {
  it("achica el lado más largo a 1200 px manteniendo la proporción", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(1000, 2000)).toEqual({ width: 600, height: 1200 });
  });

  it("no agranda imágenes pequeñas", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
