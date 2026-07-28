import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase } from "../../kb/load";
import { createEmitter } from "../ui-events";
import {
  searchManualImpl,
  getPageImpl,
  showManualImageImpl,
  renderPolarityImpl,
  renderCustomImpl,
  buildToolServer,
} from "../tools";

const here = path.dirname(fileURLToPath(import.meta.url));
const kb = loadKnowledgeBase(
  path.join(here, "../../kb/__tests__/fixtures/mini-kb.json"),
);

const textOf = (r: { content: Array<{ type: string; text?: string }> }) =>
  (r.content.find((c) => c.type === "text") as { text: string }).text;

describe("agent tools", () => {
  it("search_manual returns matching page references", () => {
    const r = searchManualImpl({ query: "polarity socket DCEN" }, kb);
    expect(textOf(r)).toContain("p.16");
  });

  it("get_page returns record text plus the page image", () => {
    const r = getPageImpl({ doc: "owner-manual", page: 16 }, kb);
    expect(textOf(r)).toContain("Polarity Setup");
    expect(textOf(r)).toContain("/manual/owner-manual-16.png");
    // The real extracted image exists on disk, so an image block is attached.
    expect(r.content.some((c) => c.type === "image")).toBe(true);
  });

  it("get_page flags an unknown page as an error", () => {
    const r = getPageImpl({ doc: "owner-manual", page: 999 }, kb);
    expect(r.isError).toBe(true);
  });

  it("show_manual_image emits one image UI event", () => {
    const em = createEmitter();
    const r = showManualImageImpl({ doc: "owner-manual", page: 16 }, kb, em);
    const events = em.drain();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "image",
      doc: "owner-manual",
      page: 16,
      src: "/manual/owner-manual-16.png",
    });
    expect(textOf(r)).toMatch(/Displayed/);
  });

  it("render_polarity_diagram emits a polarity artifact", () => {
    const em = createEmitter();
    renderPolarityImpl({ process: "TIG" }, em);
    const [e] = em.drain();
    expect(e).toMatchObject({ type: "artifact", kind: "polarity" });
    expect(e.type === "artifact" && e.html).toContain("DCEN");
  });

  it("render_custom_artifact wraps and emits the html", () => {
    const em = createEmitter();
    renderCustomImpl({ title: "Settings", html: "<p>hi</p>" }, em);
    const [e] = em.drain();
    expect(e.type).toBe("artifact");
    if (e.type === "artifact") {
      expect(e.html).toMatch(/<!doctype html>/i);
      expect(e.html).toContain("<p>hi</p>");
    }
  });

  it("buildToolServer constructs an SDK MCP server (accepts our zod-4 shapes)", () => {
    const server = buildToolServer(kb, createEmitter());
    expect(server).toBeTruthy();
  });
});
