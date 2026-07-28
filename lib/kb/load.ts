import fs from "node:fs";
import path from "node:path";
import {
  KnowledgeBaseSchema,
  type DocSlug,
  type KnowledgeBase,
  type PageRecord,
} from "./types";

const cache = new Map<string, KnowledgeBase>();

/** Default location of the committed, pre-extracted knowledge base. */
export function defaultKbPath(): string {
  return path.join(process.cwd(), "data", "knowledge-base.json");
}

/**
 * Reads and validates the knowledge base, caching by absolute path.
 * Throws a clear error if the file is missing or malformed.
 */
export function loadKnowledgeBase(kbPath?: string): KnowledgeBase {
  const abs = path.resolve(kbPath ?? defaultKbPath());
  const cached = cache.get(abs);
  if (cached) return cached;

  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch {
    throw new Error(
      `Knowledge base not found at ${abs}. Run \`npm run build:kb\` to generate it.`,
    );
  }

  const parsed = KnowledgeBaseSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`The knowledge base is invalid: ${parsed.error.message}`);
  }

  cache.set(abs, parsed.data);
  return parsed.data;
}

export function getPage(
  kb: KnowledgeBase,
  doc: DocSlug,
  page: number,
): PageRecord | undefined {
  return kb.pages.find((p) => p.doc === doc && p.page === page);
}

export interface PageIndexEntry {
  doc: DocSlug;
  page: number;
  section: string;
  title: string;
  summary: string;
}

/** A compact index (one line per page) small enough to sit in the system prompt. */
export function pageIndex(kb: KnowledgeBase): PageIndexEntry[] {
  return kb.pages.map(({ doc, page, section, title, summary }) => ({
    doc,
    page,
    section,
    title,
    summary,
  }));
}
