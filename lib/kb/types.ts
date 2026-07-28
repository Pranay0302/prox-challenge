import { z } from "zod";

/** The three source documents in files/. */
export const DocSlugSchema = z.enum([
  "owner-manual",
  "quick-start-guide",
  "selection-chart",
]);
export type DocSlug = z.infer<typeof DocSlugSchema>;

/** A table transcribed from the manual (e.g. a duty-cycle matrix). */
export const TableSchema = z.object({
  name: z.string(),
  rows: z.array(z.array(z.string())),
});
export type Table = z.infer<typeof TableSchema>;

/** A diagram/schematic/photo and what it teaches. */
export const DiagramSchema = z.object({
  name: z.string(),
  describes: z.string(),
});
export type Diagram = z.infer<typeof DiagramSchema>;

/** One extracted manual page: text + structured tables/diagrams + a web image path. */
export const PageRecordSchema = z.object({
  doc: DocSlugSchema,
  page: z.number().int().positive(),
  section: z.string(),
  title: z.string(),
  summary: z.string(),
  keyFacts: z.array(z.string()),
  tables: z.array(TableSchema),
  diagrams: z.array(DiagramSchema),
  searchableText: z.string(),
  imagePath: z.string(),
});
export type PageRecord = z.infer<typeof PageRecordSchema>;

export const KnowledgeBaseSchema = z.object({
  pages: z.array(PageRecordSchema),
});
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
