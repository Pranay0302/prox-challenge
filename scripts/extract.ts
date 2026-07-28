/**
 * Offline knowledge-base builder.
 *
 * Renders every page of the three PDFs to an image, then runs Claude vision
 * (Opus 4.8) over each page to produce a structured PageRecord — transcribing
 * tables, describing diagrams/schematics/photos, and writing keyword-dense
 * search text. Critically, this captures content that exists ONLY in images
 * (the selection chart, weld-diagnosis photos, wiring schematic, polarity
 * diagrams). Output is committed so the app never re-runs extraction.
 *
 * This is a dev-time build tool, so it may use the Messages API directly; the
 * Agent-SDK requirement applies to the runtime agent, not this builder.
 *
 * Run: npm run build:kb
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { renderPages } from "./lib/render.js";
import {
  PageRecordSchema,
  type DocSlug,
  type KnowledgeBase,
  type PageRecord,
} from "../lib/kb/types.js";

function loadEnv() {
  const anyProc = process as unknown as { loadEnvFile?: (p?: string) => void };
  if (typeof anyProc.loadEnvFile === "function") {
    try {
      anyProc.loadEnvFile(".env");
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env file */
  }
}

const DOCS: { slug: DocSlug; file: string; label: string }[] = [
  { slug: "owner-manual", file: "owner-manual.pdf", label: "Owner's Manual" },
  { slug: "quick-start-guide", file: "quick-start-guide.pdf", label: "Quick Start Guide" },
  { slug: "selection-chart", file: "selection-chart.pdf", label: "Welding Process Selection Chart" },
];

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    section: {
      type: "string",
      description: "The manual section this page belongs to (e.g. 'Specifications', 'TIG / Stick Welding', 'Maintenance').",
    },
    title: { type: "string", description: "A short title for what this page covers." },
    summary: { type: "string", description: "1-3 sentences summarizing the page for a quick index." },
    keyFacts: {
      type: "array",
      items: { type: "string" },
      description: "Atomic, verbatim-accurate facts: duty-cycle points, amperage/voltage ranges, polarity (DCEN/DCEP), socket assignments, wire sizes, tolerances, warnings.",
    },
    tables: {
      type: "array",
      description: "Every table transcribed as structured rows. Especially duty-cycle matrices and the specifications table.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["name", "rows"],
        additionalProperties: false,
      },
    },
    diagrams: {
      type: "array",
      description: "Every diagram, schematic, chart, or photo, with what it teaches. Include the selection chart, polarity/DCEN-DCEP setup, wire-feed mechanism, front-panel controls, weld-diagnosis examples, and wiring schematic.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          describes: { type: "string" },
        },
        required: ["name", "describes"],
        additionalProperties: false,
      },
    },
    searchableText: {
      type: "string",
      description: "A dense, keyword-rich paragraph capturing everything searchable on this page — including terms that only appear inside images. Repeat important terms (DCEN, DCEP, duty cycle, porosity, spatter, MIG, TIG, flux-cored, stick, amperage, voltage).",
    },
  },
  required: ["section", "title", "summary", "keyFacts", "tables", "diagrams", "searchableText"],
  additionalProperties: false,
} as const;

function buildPrompt(label: string, page: number, total: number, text: string): string {
  const textBlock = text
    ? `\n\nThe page's extractable text layer (may be incomplete or garbled — trust the image over this):\n"""\n${text.slice(0, 6000)}\n"""`
    : `\n\nThis page has NO extractable text layer — its content lives entirely in the image. Read the image carefully and transcribe everything.`;
  return (
    `You are extracting a structured knowledge record from page ${page} of ${total} of the ` +
    `Vulcan OmniPro 220 ${label}. Study the attached page image thoroughly.\n\n` +
    `Be exhaustive and precise about technical content a welder needs:\n` +
    `- Transcribe EVERY table as rows — especially duty-cycle matrices (percent @ amperage, per voltage) and the specifications table. Preserve exact numbers and units.\n` +
    `- Describe EVERY diagram, schematic, chart, control panel, and photo, and state what it teaches (e.g. which cable goes in which socket, DCEN vs DCEP, wire-feed threading, weld-defect appearance).\n` +
    `- Capture polarity setup details (DCEN/DCEP, electrode vs ground, socket labels), wire sizes, wire-feed tension, gas settings, and any safety/duty-cycle warnings as keyFacts.\n` +
    `- Write searchableText as a dense keyword paragraph so this page is findable by lexical search, including terms visible only inside images.\n` +
    `If the page is mostly boilerplate (cover, warranty, table of contents), still summarize it accurately.` +
    textBlock
  );
}

async function extractPage(
  client: Anthropic,
  doc: { slug: DocSlug; label: string },
  page: { page: number; imageAbsPath: string; imageWebPath: string; text: string },
  total: number,
): Promise<PageRecord> {
  const data = fs.readFileSync(page.imageAbsPath).toString("base64");
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    // Structured outputs: force the exact record shape.
    // (Cast: the installed SDK types may not yet surface output_config.)
    ...( { output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } } } as Record<string, unknown> ),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data } },
          { type: "text", text: buildPrompt(doc.label, page.page, total, page.text) },
        ],
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block returned for ${doc.slug} p.${page.page}`);
  }
  const partial = JSON.parse(textBlock.text);
  const record = PageRecordSchema.parse({
    ...partial,
    doc: doc.slug,
    page: page.page,
    imagePath: page.imageWebPath,
  });
  return record;
}

/** Runs an async mapper over items with bounded concurrency, preserving order. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env before running build:kb.");
  }

  const client = new Anthropic();
  const filesDir = path.join(process.cwd(), "files");
  const outDir = path.join(process.cwd(), "public", "manual");
  const allRecords: PageRecord[] = [];

  for (const doc of DOCS) {
    const pdfPath = path.join(filesDir, doc.file);
    console.log(`\n▶ Rendering ${doc.file} …`);
    const pages = renderPages(pdfPath, outDir, doc.slug);
    console.log(`  ${pages.length} pages rendered. Extracting with Claude vision …`);

    const records = await mapPool(pages, 5, async (p) => {
      const rec = await extractPage(client, doc, p, pages.length);
      process.stdout.write(`  ✓ ${doc.slug} p.${p.page}\n`);
      return rec;
    });
    allRecords.push(...records);
  }

  allRecords.sort(
    (a, b) => a.doc.localeCompare(b.doc) || a.page - b.page,
  );
  const kb: KnowledgeBase = { pages: allRecords };

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "knowledge-base.json"),
    JSON.stringify(kb, null, 2) + "\n",
    "utf8",
  );
  console.log(`\n✅ Wrote data/knowledge-base.json (${kb.pages.length} pages) and ${kb.pages.length} images to public/manual/.`);
}

main().catch((e) => {
  console.error("\n❌ Extraction failed:", e);
  process.exit(1);
});
