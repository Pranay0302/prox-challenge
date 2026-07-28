import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface RenderedPage {
  page: number;
  /** Absolute path of the rendered PNG on disk. */
  imageAbsPath: string;
  /** Web path the app serves it at, e.g. /manual/owner-manual-7.png */
  imageWebPath: string;
  /** The pdftotext text layer (empty for image-only pages). */
  text: string;
}

export function pdfPageCount(pdfPath: string): number {
  const out = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const m = out.match(/Pages:\s+(\d+)/);
  if (!m) throw new Error(`Could not read page count from ${pdfPath}`);
  return parseInt(m[1], 10);
}

/**
 * Renders every page of a PDF to a deterministic PNG name (`<slug>-<n>.png`)
 * at 150 DPI and captures its text layer. Requires poppler on PATH.
 */
export function renderPages(
  pdfPath: string,
  outDir: string,
  docSlug: string,
): RenderedPage[] {
  fs.mkdirSync(outDir, { recursive: true });

  let count: number;
  try {
    count = pdfPageCount(pdfPath);
  } catch (e) {
    throw new Error(
      "Failed to run pdfinfo — install poppler:\n" +
        "  brew install poppler            # macOS\n" +
        "  apt-get install poppler-utils   # Debian/Ubuntu\n" +
        `Original error: ${(e as Error).message}`,
    );
  }

  const pages: RenderedPage[] = [];
  for (let n = 1; n <= count; n++) {
    const base = `${docSlug}-${n}`;
    const outPrefix = path.join(outDir, base);
    // -singlefile makes pdftoppm write exactly <outPrefix>.png (no page suffix).
    execFileSync("pdftoppm", [
      "-f", String(n),
      "-l", String(n),
      "-png",
      "-r", "150",
      "-singlefile",
      pdfPath,
      outPrefix,
    ]);

    let text = "";
    try {
      text = execFileSync(
        "pdftotext",
        ["-f", String(n), "-l", String(n), pdfPath, "-"],
        { encoding: "utf8" },
      ).trim();
    } catch {
      text = "";
    }

    pages.push({
      page: n,
      imageAbsPath: `${outPrefix}.png`,
      imageWebPath: `/manual/${base}.png`,
      text,
    });
  }
  return pages;
}
