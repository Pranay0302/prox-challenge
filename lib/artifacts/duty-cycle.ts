import { wrapArtifactHtml } from "./sandbox";

export type WeldProcess = "MIG" | "TIG" | "Stick";
export type Voltage = "120V" | "240V";

export interface RatedPoint {
  dutyPct: number;
  amps: number;
}
export interface ProcessVoltageSpec {
  /** [min, max] welding current range (A). */
  range: [number, number];
  /** Rated duty-cycle points (percent @ amps). */
  points: RatedPoint[];
}

/**
 * Rated duty-cycle points for the Vulcan OmniPro 220, transcribed from the
 * owner's manual p.7 Specifications table (the authoritative source),
 * corroborated by the p.29 Stick duty-cycle page. MIG mid-points (60%) come
 * from the p.16 matrix, which is consistent with p.7 for MIG.
 * (Flux-Cored shares the MIG electrical curve.)
 *
 * Data-quality note: p.16's detailed TIG/Stick 240V matrices are mislabeled
 * (TIG and Stick rows appear swapped, and its Stick 120V lists 125A which
 * exceeds the 80A max range), so p.7 is used for TIG and Stick instead.
 */
export const RATED: Record<WeldProcess, Record<Voltage, ProcessVoltageSpec>> = {
  MIG: {
    "240V": { range: [30, 220], points: [{ dutyPct: 25, amps: 200 }, { dutyPct: 60, amps: 130 }, { dutyPct: 100, amps: 115 }] },
    "120V": { range: [30, 140], points: [{ dutyPct: 40, amps: 100 }, { dutyPct: 60, amps: 85 }, { dutyPct: 100, amps: 75 }] },
  },
  TIG: {
    "240V": { range: [10, 175], points: [{ dutyPct: 30, amps: 175 }, { dutyPct: 100, amps: 105 }] },
    "120V": { range: [10, 125], points: [{ dutyPct: 40, amps: 125 }, { dutyPct: 100, amps: 90 }] },
  },
  Stick: {
    "240V": { range: [10, 175], points: [{ dutyPct: 25, amps: 175 }, { dutyPct: 100, amps: 100 }] },
    "120V": { range: [10, 80], points: [{ dutyPct: 40, amps: 80 }, { dutyPct: 100, amps: 60 }] },
  },
};

// Client-side script: interpolates the rated curve and computes on/off timing.
// Kept as a string literal so it ships inside the sandboxed iframe.
const SCRIPT = `
const RATED = __RATED__;
function computeDutyCycle(proc, volt, amps) {
  const cfg = RATED[proc][volt];
  const [min, max] = cfg.range;
  const pts = cfg.points.slice().sort((a, b) => a.amps - b.amps); // ascending amps
  let duty, note = "";
  if (amps > max) { duty = pts[pts.length - 1].dutyPct; note = "Above this machine's max of " + max + "A for " + proc + " at " + volt + " — not supported. Reduce amperage."; }
  else if (amps < min) { duty = 100; note = "Below the usable minimum of " + min + "A."; }
  else if (amps <= pts[0].amps) { duty = 100; }
  else {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (amps >= a.amps && amps <= b.amps) {
        duty = a.dutyPct + (b.dutyPct - a.dutyPct) * (amps - a.amps) / (b.amps - a.amps);
        break;
      }
    }
    if (duty == null) duty = pts[pts.length - 1].dutyPct;
  }
  const weld = Math.round((duty / 100) * 10 * 10) / 10;   // minutes welding per 10-min cycle
  const rest = Math.round((10 - weld) * 10) / 10;
  return { duty: Math.round(duty), weld, rest, note, max };
}
function render() {
  const proc = document.getElementById("proc").value;
  const volt = document.getElementById("volt").value;
  const amps = parseInt(document.getElementById("amps").value, 10) || 0;
  document.getElementById("ampsLabel").textContent = amps + "A";
  const r = computeDutyCycle(proc, volt, amps);
  document.getElementById("duty").textContent = r.duty + "%";
  document.getElementById("timing").textContent =
    "Weld up to " + r.weld + " min, then rest " + r.rest + " min (per 10-minute cycle).";
  const warn = document.getElementById("warn");
  warn.textContent = r.note;
  warn.style.display = r.note ? "block" : "none";
  document.getElementById("amps").max = String(RATED[proc][volt].range[1]);
}
document.addEventListener("input", (e) => { if (["proc","volt","amps"].includes(e.target.id)) render(); });
render();
`;

const PROCESSES: WeldProcess[] = ["MIG", "TIG", "Stick"];

export function renderDutyCycleCalculator(
  process: WeldProcess = "MIG",
): { title: string; html: string } {
  if (!RATED[process]) {
    throw new Error(`Unknown welding process: ${process}`);
  }
  const title = "Duty-Cycle Calculator — Vulcan OmniPro 220";
  const opt = (v: string, sel: string) =>
    `<option value="${v}"${v === sel ? " selected" : ""}>${v}</option>`;
  const body = `
  <h2>Duty-Cycle Calculator</h2>
  <p style="color:var(--muted);margin-top:-6px">How long you can weld before the machine needs to cool, per its rated duty cycle.</p>
  <div class="scroll"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end">
    <label>Process<br><select id="proc">${PROCESSES.map((p) => opt(p, process)).join("")}</select></label>
    <label>Input voltage<br><select id="volt">${opt("240V", "240V")}${opt("120V", "240V")}</select></label>
    <label>Amperage: <span id="ampsLabel">150A</span><br>
      <input id="amps" type="range" min="10" max="220" value="150" step="5" style="width:220px"></label>
  </div></div>
  <div style="margin-top:18px;padding:14px;background:var(--panel);border:1px solid var(--border);border-radius:8px">
    <div style="font-size:2rem;font-weight:700">Duty cycle: <span id="duty" style="color:var(--accent)">—</span></div>
    <div id="timing" style="margin-top:6px"></div>
    <div id="warn" style="margin-top:8px;color:var(--warn);font-weight:600;display:none"></div>
  </div>
  <p style="color:var(--muted);font-size:.85rem;margin-top:12px">Source: OmniPro 220 owner's manual, Specifications (p.7) &amp; duty-cycle matrices (p.16, p.19).</p>
  <script>${SCRIPT.replace("__RATED__", JSON.stringify(RATED))}</script>`;
  return { title, html: wrapArtifactHtml(body, { title }) };
}
