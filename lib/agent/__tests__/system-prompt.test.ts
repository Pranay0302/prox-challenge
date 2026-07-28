import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase } from "../../kb/load";
import { buildSystemPrompt } from "../system-prompt";

const here = path.dirname(fileURLToPath(import.meta.url));
const kb = loadKnowledgeBase(
  path.join(here, "../../kb/__tests__/fixtures/mini-kb.json"),
);
const sp = buildSystemPrompt(kb);

describe("buildSystemPrompt", () => {
  it("instructs inline citation", () => {
    expect(sp).toContain("[doc p.N]");
  });

  it("includes the voltage-clarification guidance", () => {
    expect(sp).toMatch(/120V/);
    expect(sp).toMatch(/240V/);
    expect(sp).toMatch(/clarif/i);
    expect(sp).toMatch(/duty cycle/i);
  });

  it("embeds a compact page index from the KB", () => {
    expect(sp).toMatch(/owner-manual p\.16/);
    expect(sp).toMatch(/Polarity Setup/);
  });
});
