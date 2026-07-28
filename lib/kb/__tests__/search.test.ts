import { describe, it, expect } from "vitest";
import { searchManual } from "../search";
import type { KnowledgeBase } from "../types";

const kb: KnowledgeBase = {
  pages: [
    {
      doc: "owner-manual",
      page: 7,
      section: "Specifications",
      title: "Specs",
      summary: "Duty cycle and current ranges for MIG at 120V and 240V.",
      keyFacts: ["25% @ 200A on 240V MIG", "40% @ 100A on 120V"],
      tables: [{ name: "Rated Duty Cycles", rows: [["240V", "25% @ 200A"]] }],
      diagrams: [],
      searchableText: "duty cycle MIG 200A 240V 25 percent welding",
      imagePath: "/manual/owner-manual-7.png",
    },
    {
      doc: "owner-manual",
      page: 16,
      section: "TIG / Stick",
      title: "Polarity Setup",
      summary: "DCEN and DCEP cable-to-socket setup for TIG and Stick.",
      keyFacts: ["TIG uses DCEN", "ground clamp in positive socket for DCEN"],
      tables: [],
      diagrams: [{ name: "DCEN diagram", describes: "torch to negative" }],
      searchableText: "polarity DCEN DCEP TIG stick ground clamp socket welding",
      imagePath: "/manual/owner-manual-16.png",
    },
  ],
};

describe("searchManual", () => {
  it("ranks the duty-cycle page first for a duty-cycle query", () => {
    const [top] = searchManual(kb, "duty cycle MIG 200A 240V");
    expect(top.page).toBe(7);
  });

  it("ranks the polarity page first for a polarity query", () => {
    const [top] = searchManual(kb, "which socket for TIG ground clamp polarity");
    expect(top.page).toBe(16);
  });

  it("respects the limit", () => {
    expect(searchManual(kb, "welding", 1)).toHaveLength(1);
  });

  it("returns nothing for a query with no matching terms", () => {
    expect(searchManual(kb, "xyzzy nonexistent")).toHaveLength(0);
  });
});
