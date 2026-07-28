import { wrapArtifactHtml } from "./sandbox";

export type TroubleTopic = "porosity" | "spatter" | "penetration" | "general";

export interface Check {
  cause: string;
  fix: string;
  migOnly?: boolean;
}
export interface Defect {
  name: string;
  appearance: string;
  checks: Check[];
}

/**
 * Weld-defect diagnosis for the Vulcan OmniPro 220, transcribed from the
 * owner's manual Welding Tips / Weld Diagnosis pages: wire welds p.35–37,
 * stick welds p.38–40. (Weld-diagnosis photos are surfaced separately by the
 * agent's show_manual_image tool — the sandboxed artifact can't load them.)
 */
export const DEFECTS: Record<string, Defect> = {
  porosity: {
    name: "Porosity",
    appearance: "Small cavities or holes scattered in the bead.",
    checks: [
      { cause: "Wrong polarity for the process", fix: "Verify DCEN/DCEP is correct for your process (see the polarity setup)." },
      { cause: "Insufficient shielding gas", fix: "Increase gas flow (20–30 SCFH), clean the nozzle, and keep CTWD short.", migOnly: true },
      { cause: "Wrong shielding gas", fix: "Use the gas your wire supplier recommends.", migOnly: true },
      { cause: "Dirty workpiece or wire", fix: "Clean down to bare metal — no oil, paint, rust, or coatings; keep the wire clean." },
      { cause: "Inconsistent travel speed", fix: "Keep a steady travel speed." },
      { cause: "CTWD too long", fix: "Reduce contact-tip-to-work distance (keep under 1/2\")." },
    ],
  },
  spatter: {
    name: "Excessive spatter",
    appearance: "Grainy, large spatter droplets around the bead (fine spatter is normal).",
    checks: [
      { cause: "Dirty workpiece or wire", fix: "Clean to bare metal, free of oil, coatings, and residues." },
      { cause: "Wrong polarity", fix: "Check that polarity is set correctly for the process." },
      { cause: "Insufficient shielding gas", fix: "Increase gas flow, clean the nozzle, and maintain a short CTWD.", migOnly: true },
      { cause: "Wire feeding too fast", fix: "Reduce the wire feed speed." },
      { cause: "CTWD too long", fix: "Reduce contact-tip-to-work distance." },
    ],
  },
  "inadequate-penetration": {
    name: "Inadequate penetration",
    appearance: "Weld sits on the surface and doesn't reach fully into the joint.",
    checks: [
      { cause: "CTWD too long", fix: "Keep contact-tip-to-work distance at 1/2\" or less." },
      { cause: "Arc not on the puddle's leading edge", fix: "Keep the arc on the leading edge; hold the gun/torch at the proper angle." },
      { cause: "Travel speed too fast", fix: "Slow down your travel speed." },
      { cause: "Weld current too low", fix: "Increase the weld current." },
      { cause: "Thick material", fix: "Bevel the edges, leave a slight gap, and weld in several passes." },
      { cause: "Wire feed too slow", fix: "Increase the wire feed speed." },
    ],
  },
  "excess-penetration": {
    name: "Excess penetration / burn-through",
    appearance: "Weld droops through the joint or melts a hole in the base metal.",
    checks: [
      { cause: "Too much heat / current", fix: "Decrease the weld current." },
      { cause: "Wire feed too fast", fix: "Reduce the wire feed speed." },
      { cause: "Travel speed too slow", fix: "Increase travel speed and keep it steady." },
      { cause: "Too much material at the weld", fix: "Reduce excess material; on thin stock make shorter passes and let it cool." },
    ],
  },
  "crooked-bead": {
    name: "Crooked / wavy bead",
    appearance: "Bead wanders in an irregular, wavy path.",
    checks: [
      { cause: "Unsteady hand", fix: "Use two hands or rest your hand on a steady surface." },
      { cause: "Inconsistent travel speed", fix: "Maintain a steady travel speed." },
      { cause: "CTWD too long", fix: "Reduce contact-tip-to-work distance." },
    ],
  },
};

const ORDER = ["porosity", "spatter", "inadequate-penetration", "excess-penetration", "crooked-bead"];

const TOPIC_TO_DEFECT: Record<TroubleTopic, string> = {
  porosity: "porosity",
  spatter: "spatter",
  penetration: "inadequate-penetration",
  general: "porosity",
};

const SCRIPT = `
const DEFECTS = __DEFECTS__;
function selectDefect(id) {
  const d = DEFECTS[id];
  if (!d) return;
  document.querySelectorAll("[data-defect]").forEach((b) =>
    b.setAttribute("aria-current", b.getAttribute("data-defect") === id ? "true" : "false"));
  let html = "<h3>" + d.name + "</h3><p style='color:var(--muted);margin-top:-6px'>" + d.appearance + "</p><ol>";
  for (const c of d.checks) {
    html += "<li style='margin-bottom:8px'><strong>Check: " + c.cause + (c.migOnly ? " <em>(MIG only)</em>" : "") +
      "</strong><br>→ " + c.fix + "</li>";
  }
  html += "</ol>";
  document.getElementById("detail").innerHTML = html;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-defect]");
  if (b) selectDefect(b.getAttribute("data-defect"));
});
`;

export function renderTroubleshootingFlowchart(
  topic: TroubleTopic = "general",
): { title: string; html: string } {
  const startId = TOPIC_TO_DEFECT[topic];
  if (!startId) throw new Error(`Unknown troubleshooting topic: ${topic}`);

  const title = "Weld Troubleshooting — Vulcan OmniPro 220";
  const buttons = ORDER.map((id) => {
    const d = DEFECTS[id];
    const cur = id === startId ? "true" : "false";
    return `<button data-defect="${id}" aria-current="${cur}" style="padding:8px 12px;border:1px solid var(--border);border-radius:999px;background:var(--panel);color:var(--fg);cursor:pointer">${d.name}</button>`;
  }).join(" ");

  const d0 = DEFECTS[startId];
  const initialDetail =
    `<h3>${d0.name}</h3><p style="color:var(--muted);margin-top:-6px">${d0.appearance}</p><ol>` +
    d0.checks
      .map(
        (c) =>
          `<li style="margin-bottom:8px"><strong>Check: ${c.cause}${c.migOnly ? " <em>(MIG only)</em>" : ""}</strong><br>&rarr; ${c.fix}</li>`,
      )
      .join("") +
    `</ol>`;

  const body = `
  <h2>Weld Troubleshooting</h2>
  <p style="color:var(--muted);margin-top:-6px">Pick the symptom you're seeing, then work down the checklist.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${buttons}</div>
  <div id="detail" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px">${initialDetail}</div>
  <style>
    [data-defect][aria-current="true"] { background:var(--accent); color:#fff; border-color:var(--accent); }
    #detail ol { padding-left:20px; }
  </style>
  <p style="color:var(--muted);font-size:.85rem">Source: owner's manual Weld Diagnosis — wire welds p.35–37, stick welds p.38–40.</p>
  <script>${SCRIPT.replace("__DEFECTS__", JSON.stringify(DEFECTS))}</script>`;

  return { title, html: wrapArtifactHtml(body, { title }) };
}
