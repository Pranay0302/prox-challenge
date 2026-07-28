import { describe, it, expect } from "vitest";
import { renderDutyCycleCalculator, RATED } from "../duty-cycle";

describe("renderDutyCycleCalculator", () => {
  it("wraps a self-contained document", () => {
    expect(renderDutyCycleCalculator("MIG").html).toMatch(/<!doctype html>/i);
  });

  it("seeds the real 240V MIG rated point (25% @ 200A)", () => {
    expect(RATED.MIG["240V"].points).toContainEqual({ dutyPct: 25, amps: 200 });
    const { html } = renderDutyCycleCalculator("MIG");
    expect(html).toContain("240V");
    expect(html).toContain("200");
    expect(html).toMatch(/computeDutyCycle/);
  });

  it("includes interactive controls", () => {
    const { html } = renderDutyCycleCalculator("TIG");
    expect(html).toMatch(/<select/);
    expect(html).toMatch(/<input/);
  });

  it("throws on an unknown process", () => {
    // @ts-expect-error runtime guard test
    expect(() => renderDutyCycleCalculator("Laser")).toThrow();
  });
});
