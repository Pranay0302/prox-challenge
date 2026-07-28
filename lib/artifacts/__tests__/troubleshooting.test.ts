import { describe, it, expect } from "vitest";
import { renderTroubleshootingFlowchart, DEFECTS } from "../troubleshooting";

describe("renderTroubleshootingFlowchart", () => {
  it("wraps a self-contained document", () => {
    expect(renderTroubleshootingFlowchart("porosity").html).toMatch(/<!doctype html>/i);
  });

  it("surfaces the real porosity checks", () => {
    const { html } = renderTroubleshootingFlowchart("porosity");
    expect(html).toMatch(/bare metal/i); // contamination fix
    expect(html).toMatch(/gas flow|shielding gas/i); // MIG gas check
    expect(html).toMatch(/polarity/i);
    expect(html).toMatch(/selectDefect/); // interactive navigation
  });

  it("includes buttons for multiple defects", () => {
    const { html } = renderTroubleshootingFlowchart("general");
    expect(html).toMatch(/porosity/i);
    expect(html).toMatch(/spatter/i);
    expect(html).toMatch(/penetration/i);
  });

  it("has a known set of defects with causes+fixes", () => {
    expect(DEFECTS.porosity.checks.length).toBeGreaterThan(2);
    for (const c of DEFECTS.porosity.checks) {
      expect(c.cause).toBeTruthy();
      expect(c.fix).toBeTruthy();
    }
  });

  it("throws on an unknown topic", () => {
    // @ts-expect-error runtime guard test
    expect(() => renderTroubleshootingFlowchart("aliens")).toThrow();
  });
});
