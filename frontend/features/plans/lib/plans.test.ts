import { afterEach, describe, expect, it, vi } from "vitest";

import { canUse, effectivePlan, getLimit } from "./plans";

const NOW = new Date("2026-10-31T15:00:00Z");
const free = { plan: "free" as const, planExpiresAt: null };
const pro = { plan: "pro" as const, planExpiresAt: "2026-12-31T00:00:00Z" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("planes", () => {
  it("durante la beta todos se comportan como Pro", () => {
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "false");
    expect(effectivePlan(free, NOW)).toBe("pro");
    expect(getLimit(free, "maxProducts", NOW)).toBeNull();
    expect(canUse(free, "stockHistory", NOW)).toBe(true);
  });

  it("con planes activos aplica los límites de la SPEC", () => {
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "true");
    expect(getLimit(free, "maxProducts", NOW)).toBe(20);
    expect(getLimit(free, "maxMembers", NOW)).toBe(1);
    expect(canUse(free, "stockHistory", NOW)).toBe(false);
    expect(canUse(free, "fullStats", NOW)).toBe(false);
    expect(canUse(free, "hideBranding", NOW)).toBe(false);
    expect(canUse(pro, "fullStats", NOW)).toBe(true);
    expect(canUse(pro, "hideBranding", NOW)).toBe(true);
    expect(getLimit(pro, "maxProducts", NOW)).toBeNull();
    expect(canUse(pro, "stockHistory", NOW)).toBe(true);
  });

  it("Pro vencido sigue 7 días de gracia y luego cuenta como gratis", () => {
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "true");
    const expired = { plan: "pro" as const, planExpiresAt: "2026-10-25T15:00:00Z" };
    expect(effectivePlan(expired, NOW)).toBe("pro");
    expect(effectivePlan(expired, new Date("2026-11-01T15:01:00Z"))).toBe("free");
  });
});
