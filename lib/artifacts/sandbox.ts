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
    color-scheme: dark;
    --bg:#1b1e22; --fg:#e8e5dd; --muted:#9a978d; --accent:#cf9f77;
    --border:rgba(255,255,255,0.13); --panel:rgba(255,255,255,0.06); --ok:#7fbf8a; --warn:#dd8f6a;
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--fg);
    font-family: "Styrene B",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5; }
  main { padding:16px; }
  img { max-width:100%; height:auto; }
  .scroll { overflow-x:auto; }
  button, select, input { font:inherit; }
  select, input[type=range] { accent-color:var(--accent); }
  h1,h2,h3 { font-family:"Copernicus",Georgia,serif; color:var(--fg); }
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
