export interface WrapOptions {
  title?: string;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

/**
 * Wraps artifact body HTML into a fully self-contained document for a
 * sandboxed `<iframe srcdoc>`: CSS reset, light/dark theme, responsive
 * images, and a height-reporting script the host uses to size the frame.
 * No external CDNs, fonts, or network requests — the strict artifact
 * contract (reverse-engineered from Claude artifacts).
 */
export function wrapArtifactHtml(bodyHtml: string, opts: WrapOptions = {}): string {
  const title = escapeHtml(opts.title ?? "Artifact");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg:#ffffff; --fg:#1a1a1a; --muted:#5c626c; --accent:#c85a12;
    --border:#e4e4e0; --panel:#f6f6f3; --ok:#1f8a4c; --warn:#c0392b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#1c1f26; --fg:#e8e6e1; --muted:#9aa0aa; --accent:#ff7a1a;
      --border:#2a2e37; --panel:#232732; --ok:#3ecf76; --warn:#ff6b5e;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--fg);
    font-family: system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5; }
  main { padding:16px; }
  img { max-width:100%; height:auto; }
  .scroll { overflow-x:auto; }
  button, select, input { font:inherit; }
  h1,h2,h3 { color:var(--accent); }
</style>
</head>
<body>
<main>${bodyHtml}</main>
<script>
  function reportHeight() {
    try { parent.postMessage({ type: "artifact-height", height: document.body.scrollHeight }, "*"); } catch (e) {}
  }
  window.addEventListener("load", reportHeight);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(reportHeight).observe(document.body);
  setTimeout(reportHeight, 300);
</script>
</body>
</html>`;
}
