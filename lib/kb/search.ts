import type { KnowledgeBase, PageRecord } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "is",
  "are", "do", "does", "i", "what", "whats", "which", "how", "my", "me", "you",
  "your", "it", "this", "that", "with", "need", "should", "when", "if", "be",
  "was", "am", "can", "get", "getting",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function pageText(p: PageRecord): string {
  return [
    p.title,
    p.section,
    p.summary,
    p.keyFacts.join(" "),
    p.tables.map((t) => `${t.name} ${t.rows.flat().join(" ")}`).join(" "),
    p.diagrams.map((d) => `${d.name} ${d.describes}`).join(" "),
    p.searchableText,
  ].join(" ");
}

const DOC_ORDER: Record<string, number> = {
  "owner-manual": 0,
  "quick-start-guide": 1,
  "selection-chart": 2,
};

/**
 * Lexical BM25 ranking over the knowledge base. No embeddings, no second
 * vendor — deterministic and good enough at this corpus size (~51 pages).
 */
export function searchManual(
  kb: KnowledgeBase,
  query: string,
  limit = 5,
): PageRecord[] {
  const qTerms = Array.from(new Set(tokenize(query)));
  if (qTerms.length === 0) return kb.pages.slice(0, limit);

  const docs = kb.pages.map((p) => tokenize(pageText(p)));
  const N = docs.length;
  const avgLen = N ? docs.reduce((s, d) => s + d.length, 0) / N : 0;

  const df = new Map<string, number>();
  for (const term of qTerms) {
    let count = 0;
    for (const d of docs) if (d.includes(term)) count++;
    df.set(term, count);
  }

  const k = 1.5;
  const b = 0.75;
  const scored = kb.pages.map((p, i) => {
    const d = docs[i];
    const len = d.length || 1;
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * (f * (k + 1))) / (f + k * (1 - b + b * (len / avgLen)));
    }
    return { p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort(
      (a, c) =>
        c.score - a.score ||
        DOC_ORDER[a.p.doc] - DOC_ORDER[c.p.doc] ||
        a.p.page - c.p.page,
    )
    .slice(0, limit)
    .map((s) => s.p);
}
