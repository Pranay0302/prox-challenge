import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase, getPage, pageIndex } from "../load";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "fixtures");

describe("loadKnowledgeBase", () => {
  it("loads and validates the fixture knowledge base", () => {
    const kb = loadKnowledgeBase(path.join(fixtures, "mini-kb.json"));
    expect(kb.pages).toHaveLength(2);
  });

  it("finds a page by doc + page number", () => {
    const kb = loadKnowledgeBase(path.join(fixtures, "mini-kb.json"));
    expect(getPage(kb, "owner-manual", 16)?.title).toMatch(/polarity/i);
    expect(getPage(kb, "owner-manual", 999)).toBeUndefined();
  });

  it("builds a compact page index", () => {
    const kb = loadKnowledgeBase(path.join(fixtures, "mini-kb.json"));
    const idx = pageIndex(kb);
    expect(idx[0]).toEqual({
      doc: "owner-manual",
      page: 7,
      section: "Specifications",
      title: "Specifications",
      summary: "Duty cycle and current ranges for MIG at 120V and 240V.",
    });
  });

  it("throws a clear error when the JSON is missing a required field", () => {
    expect(() =>
      loadKnowledgeBase(path.join(fixtures, "invalid-kb.json")),
    ).toThrow(/knowledge base is invalid/i);
  });
});
