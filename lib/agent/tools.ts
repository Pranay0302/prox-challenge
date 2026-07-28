import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { DocSlug, KnowledgeBase } from "../kb/types";
import { getPage } from "../kb/load";
import { searchManual } from "../kb/search";
import type { Emitter } from "./ui-events";
import { wrapArtifactHtml } from "../artifacts/sandbox";
import { renderPolarityDiagram, type PolarityProcess } from "../artifacts/polarity";
import { renderDutyCycleCalculator, type WeldProcess } from "../artifacts/duty-cycle";
import { renderTroubleshootingFlowchart, type TroubleTopic } from "../artifacts/troubleshooting";

// Minimal structural view of an MCP CallToolResult (assignable to the SDK type).
type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  // Index signature so this is structurally assignable to the SDK's CallToolResult.
  [key: string]: unknown;
}

const DOC_VALUES = ["owner-manual", "quick-start-guide", "selection-chart"] as const;

// ---------- Pure tool implementations (unit-testable) ----------

export function searchManualImpl(
  input: { query: string },
  kb: KnowledgeBase,
): ToolResult {
  const hits = searchManual(kb, input.query, 5);
  if (hits.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No manual pages matched "${input.query}". Try different keywords, or call get_page on a page you suspect.`,
        },
      ],
    };
  }
  const lines = hits.map((h) => `[${h.doc} p.${h.page}] ${h.title} — ${h.summary}`);
  return {
    content: [
      {
        type: "text",
        text: `Top matches (call get_page to read one in full, with its image):\n${lines.join("\n")}`,
      },
    ],
  };
}

export function getPageImpl(
  input: { doc: DocSlug; page: number },
  kb: KnowledgeBase,
): ToolResult {
  const p = getPage(kb, input.doc, input.page);
  if (!p) {
    return {
      content: [{ type: "text", text: `No page ${input.doc} p.${input.page} in the manual.` }],
      isError: true,
    };
  }
  const tables = p.tables
    .map((t) => `Table "${t.name}":\n${t.rows.map((r) => "  " + r.join(" | ")).join("\n")}`)
    .join("\n\n");
  const diagrams = p.diagrams.map((d) => `- ${d.name}: ${d.describes}`).join("\n");
  const text =
    `${p.doc} p.${p.page} — ${p.title}  [section: ${p.section}]\n` +
    `Image: ${p.imagePath}\n\n` +
    `Summary: ${p.summary}\n\n` +
    (p.keyFacts.length ? `Key facts:\n${p.keyFacts.map((f) => "- " + f).join("\n")}\n\n` : "") +
    (tables ? `${tables}\n\n` : "") +
    (diagrams ? `Diagrams:\n${diagrams}\n` : "");

  const content: ToolContent[] = [{ type: "text", text }];
  // Attach the page image so the model can visually reason over diagrams/tables.
  try {
    const abs = path.join(process.cwd(), "public", p.imagePath);
    const data = fs.readFileSync(abs).toString("base64");
    content.push({ type: "image", data, mimeType: "image/png" });
  } catch {
    /* image optional — text still returned */
  }
  return { content };
}

export function showManualImageImpl(
  input: { doc: DocSlug; page: number; caption?: string },
  kb: KnowledgeBase,
  emitter: Emitter,
): ToolResult {
  const p = getPage(kb, input.doc, input.page);
  if (!p) {
    return {
      content: [{ type: "text", text: `No page ${input.doc} p.${input.page} to show.` }],
      isError: true,
    };
  }
  emitter.emit({
    type: "image",
    doc: p.doc,
    page: p.page,
    src: p.imagePath,
    caption: input.caption ?? `${p.title} (${p.doc} p.${p.page})`,
  });
  return {
    content: [
      { type: "text", text: `Displayed ${p.doc} page ${p.page} (${p.title}) to the user.` },
    ],
  };
}

export function renderPolarityImpl(
  input: { process: PolarityProcess },
  emitter: Emitter,
): ToolResult {
  const { title, html } = renderPolarityDiagram(input.process);
  emitter.emit({ type: "artifact", kind: "polarity", title, html });
  return {
    content: [
      { type: "text", text: `Rendered the interactive polarity setup diagram for ${input.process} to the user.` },
    ],
  };
}

export function renderDutyCycleImpl(
  input: { process: WeldProcess },
  emitter: Emitter,
): ToolResult {
  const { title, html } = renderDutyCycleCalculator(input.process);
  emitter.emit({ type: "artifact", kind: "duty-cycle", title, html });
  return {
    content: [
      { type: "text", text: `Rendered the interactive duty-cycle calculator (${input.process}) to the user.` },
    ],
  };
}

export function renderTroubleshootingImpl(
  input: { topic: TroubleTopic },
  emitter: Emitter,
): ToolResult {
  const { title, html } = renderTroubleshootingFlowchart(input.topic);
  emitter.emit({ type: "artifact", kind: "troubleshooting", title, html });
  return {
    content: [
      { type: "text", text: `Rendered the interactive weld troubleshooter (${input.topic}) to the user.` },
    ],
  };
}

export function renderCustomImpl(
  input: { title: string; html: string },
  emitter: Emitter,
): ToolResult {
  const html = wrapArtifactHtml(input.html, { title: input.title });
  emitter.emit({ type: "artifact", kind: "custom", title: input.title, html });
  return {
    content: [{ type: "text", text: `Rendered "${input.title}" to the user.` }],
  };
}

// ---------- SDK MCP server wiring ----------

/** Builds the in-process MCP server exposing all Vulcan tools to the agent. */
export function buildToolServer(kb: KnowledgeBase, emitter: Emitter) {
  return createSdkMcpServer({
    name: "vulcan",
    version: "1.0.0",
    tools: [
      tool(
        "search_manual",
        "Search the Vulcan OmniPro 220 manuals by keyword. Returns the best-matching page references (doc + page + summary). Use this to locate content, then call get_page to read a page in full.",
        { query: z.string().describe("Keywords to search for, e.g. 'MIG duty cycle 240V' or 'porosity flux-cored'.") },
        async (a) => searchManualImpl(a, kb),
      ),
      tool(
        "get_page",
        "Read one manual page in full — its transcribed text, tables, key facts, diagram descriptions, AND the page image itself so you can visually verify diagrams, schematics, and matrices. Prefer this over answering from memory.",
        {
          doc: z.enum(DOC_VALUES).describe("Which document."),
          page: z.number().int().positive().describe("1-based page number within that document."),
        },
        async (a) => getPageImpl(a, kb),
      ),
      tool(
        "show_manual_image",
        "Show a specific manual page image to the USER in the chat (e.g. a wiring schematic, wire-feed photo, weld-diagnosis example, or the selection chart). Use when the answer is best seen.",
        {
          doc: z.enum(DOC_VALUES),
          page: z.number().int().positive(),
          caption: z.string().optional().describe("Optional caption shown under the image."),
        },
        async (a) => showManualImageImpl(a, kb, emitter),
      ),
      tool(
        "render_polarity_diagram",
        "Show an interactive cable→socket polarity diagram (which cable goes in + vs –, and DCEN/DCEP) for a process. Use for any polarity/cable-setup question.",
        { process: z.enum(["MIG", "Flux-Cored", "TIG", "Stick"]) },
        async (a) => renderPolarityImpl(a, emitter),
      ),
      tool(
        "render_duty_cycle_calculator",
        "Show an interactive duty-cycle calculator (process + voltage + amperage → duty %, weld/rest minutes). Use for duty-cycle questions.",
        { process: z.enum(["MIG", "TIG", "Stick"]) },
        async (a) => renderDutyCycleImpl(a, emitter),
      ),
      tool(
        "render_troubleshooting_flowchart",
        "Show an interactive weld-defect troubleshooter (symptom → causes → fixes). Use for porosity, spatter, penetration, burn-through, or crooked-bead problems.",
        { topic: z.enum(["porosity", "spatter", "penetration", "general"]) },
        async (a) => renderTroubleshootingImpl(a, emitter),
      ),
      tool(
        "render_custom_artifact",
        "Render a custom, fully self-contained interactive HTML artifact (inline CSS/JS only, no external resources) when the built-in artifacts don't fit — e.g. a settings configurator. Provide the <body> HTML; it is wrapped and sandboxed automatically.",
        {
          title: z.string(),
          html: z.string().describe("Body HTML (no <html>/<head>/<body> tags; inline <style>/<script> only)."),
        },
        async (a) => renderCustomImpl(a, emitter),
      ),
    ],
  });
}

/** Tool names the agent is allowed to call (namespaced by the SDK). */
export const VULCAN_TOOL_NAMES = [
  "search_manual",
  "get_page",
  "show_manual_image",
  "render_polarity_diagram",
  "render_duty_cycle_calculator",
  "render_troubleshooting_flowchart",
  "render_custom_artifact",
].map((n) => `mcp__vulcan__${n}`);
