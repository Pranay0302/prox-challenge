import { describe, it, expect } from "vitest";
import { renderPolarityDiagram, POLARITY } from "../polarity";

describe("renderPolarityDiagram", () => {
  it("wraps a self-contained document", () => {
    expect(renderPolarityDiagram("TIG").html).toMatch(/<!doctype html>/i);
  });

  it("shows DCEN and both sockets for TIG", () => {
    const { html } = renderPolarityDiagram("TIG");
    expect(html).toContain("DCEN");
    expect(html).toContain("Positive");
    expect(html).toContain("Negative");
  });

  it("uses DCEP for Stick but DCEN for TIG (matches the manual)", () => {
    expect(POLARITY.Stick.dc).toBe("DCEP");
    expect(POLARITY.TIG.dc).toBe("DCEN");
    expect(renderPolarityDiagram("Stick").html).toContain("DCEP");
    expect(renderPolarityDiagram("TIG").html).toContain("DCEN");
  });

  it("routes MIG gun to positive and ground to negative (DCEP)", () => {
    expect(POLARITY.MIG.dc).toBe("DCEP");
    expect(POLARITY.MIG.posCable).toMatch(/gun/i);
    expect(POLARITY.MIG.negCable).toMatch(/ground/i);
  });

  it("throws on an unknown process", () => {
    // @ts-expect-error runtime guard test
    expect(() => renderPolarityDiagram("Laser")).toThrow();
  });
});
