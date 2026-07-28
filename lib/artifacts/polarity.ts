import { wrapArtifactHtml } from "./sandbox";

export type PolarityProcess = "MIG" | "Flux-Cored" | "TIG" | "Stick";

export interface PolaritySetup {
  dc: "DCEN" | "DCEP";
  /** Short label of the cable that goes in the Negative (–) socket. */
  negCable: string;
  /** Short label of the cable that goes in the Positive (+) socket. */
  posCable: string;
  note: string;
  page: number;
}

/**
 * Cable-to-socket polarity setup for each process, transcribed from the
 * Vulcan OmniPro 220 owner's manual: Flux-Cored DCEN (p.13), MIG/solid-core
 * DCEP (p.14), TIG DCEN (p.24), Stick DCEP (p.27). Front-panel sockets are
 * labeled "+" (Positive) and "–" (Negative), p.8.
 */
export const POLARITY: Record<PolarityProcess, PolaritySetup> = {
  MIG: {
    dc: "DCEP",
    negCable: "Ground clamp",
    posCable: "MIG gun",
    note: "Solid-core MIG (with shielding gas) uses DCEP — electrode positive. The MIG gun's Wire Feed Power cable goes in the Positive (+) socket; the ground clamp goes in Negative (–). The optional aluminum spool gun uses this same DCEP setup.",
    page: 14,
  },
  "Flux-Cored": {
    dc: "DCEN",
    negCable: "Gun (wire feed)",
    posCable: "Ground clamp",
    note: "Gasless flux-cored uses DCEN — electrode negative, the opposite of MIG. The gun's Wire Feed Power cable goes in the Negative (–) socket; the ground clamp goes in Positive (+).",
    page: 13,
  },
  TIG: {
    dc: "DCEN",
    negCable: "TIG torch",
    posCable: "Ground clamp",
    note: "TIG uses DCEN — electrode negative. The TIG torch cable goes in the Negative (–) socket; the ground clamp goes in Positive (+). Twist each Dinse plug clockwise to lock.",
    page: 24,
  },
  Stick: {
    dc: "DCEP",
    negCable: "Ground clamp",
    posCable: "Electrode holder",
    note: "Stick (SMAW) on this machine uses a DCEP-style setup: the electrode holder cable goes in the Positive (+) socket; the ground clamp goes in Negative (–).",
    page: 27,
  },
};

const PROCESSES: PolarityProcess[] = ["MIG", "Flux-Cored", "TIG", "Stick"];

function svg(): string {
  // Negative socket on the left, positive on the right (manual p.20).
  return `
  <svg viewBox="0 0 520 300" width="100%" style="max-width:520px;display:block;margin:8px auto">
    <rect x="30" y="70" width="460" height="180" rx="14" fill="var(--panel)" stroke="var(--border)" stroke-width="2"/>
    <text x="260" y="98" text-anchor="middle" fill="var(--muted)" font-size="13">OmniPro 220 — front output sockets</text>

    <!-- cable labels -->
    <rect id="negBox" x="70" y="118" width="150" height="34" rx="8" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>
    <text id="negCable" x="145" y="140" text-anchor="middle" fill="var(--fg)" font-size="14" font-weight="600">Ground clamp</text>
    <line x1="145" y1="152" x2="145" y2="188" stroke="var(--accent)" stroke-width="2"/>

    <rect id="posBox" x="300" y="118" width="150" height="34" rx="8" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>
    <text id="posCable" x="375" y="140" text-anchor="middle" fill="var(--fg)" font-size="14" font-weight="600">MIG gun</text>
    <line x1="375" y1="152" x2="375" y2="188" stroke="var(--accent)" stroke-width="2"/>

    <!-- sockets -->
    <circle cx="145" cy="210" r="30" fill="var(--bg)" stroke="var(--fg)" stroke-width="3"/>
    <text x="145" y="220" text-anchor="middle" fill="var(--fg)" font-size="30" font-weight="700">&#8722;</text>
    <text x="145" y="262" text-anchor="middle" fill="var(--muted)" font-size="13">Negative (–)</text>

    <circle cx="375" cy="210" r="30" fill="var(--bg)" stroke="var(--fg)" stroke-width="3"/>
    <text x="375" y="220" text-anchor="middle" fill="var(--fg)" font-size="30" font-weight="700">+</text>
    <text x="375" y="262" text-anchor="middle" fill="var(--muted)" font-size="13">Positive (+)</text>
  </svg>`;
}

const SCRIPT = `
const POLARITY = __POLARITY__;
function apply(proc) {
  const s = POLARITY[proc];
  document.getElementById("negCable").textContent = s.negCable;
  document.getElementById("posCable").textContent = s.posCable;
  document.getElementById("dcBadge").textContent = s.dc;
  document.getElementById("note").textContent = s.note;
}
document.getElementById("proc").addEventListener("change", (e) => apply(e.target.value));
`;

export function renderPolarityDiagram(
  process: PolarityProcess = "MIG",
): { title: string; html: string } {
  const setup = POLARITY[process];
  if (!setup) throw new Error(`Unknown welding process: ${process}`);

  const title = "Polarity & Cable Setup — Vulcan OmniPro 220";
  const options = PROCESSES.map(
    (p) => `<option value="${p}"${p === process ? " selected" : ""}>${p}</option>`,
  ).join("");

  // Server-render the initial values so it reads correctly before JS runs.
  const initial = svg()
    .replace(">Ground clamp<", `>${setup.negCable}<`)
    .replace(">MIG gun<", `>${setup.posCable}<`);

  const body = `
  <h2>Polarity &amp; Cable Setup</h2>
  <p style="color:var(--muted);margin-top:-6px">Which cable goes in which socket on the front panel.</p>
  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <label>Process <select id="proc">${options}</select></label>
    <span id="dcBadge" style="background:var(--accent);color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;font-size:.85rem">${setup.dc}</span>
  </div>
  ${initial}
  <p id="note" style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px">${setup.note}</p>
  <p style="color:var(--muted);font-size:.85rem">Source: owner's manual — Flux-Cored/MIG polarity (p.13–14), TIG (p.24), Stick (p.27), sockets (p.8).</p>
  <script>${SCRIPT.replace("__POLARITY__", JSON.stringify(POLARITY))}</script>`;

  return { title, html: wrapArtifactHtml(body, { title }) };
}
