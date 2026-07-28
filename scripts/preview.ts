/** Dev-only: dump artifact HTML to /tmp for visual preview. */
import fs from "node:fs";
import { renderPolarityDiagram } from "../lib/artifacts/polarity.js";
import { renderDutyCycleCalculator } from "../lib/artifacts/duty-cycle.js";
import { renderTroubleshootingFlowchart } from "../lib/artifacts/troubleshooting.js";

fs.writeFileSync("/tmp/art-polarity.html", renderPolarityDiagram("TIG").html);
fs.writeFileSync("/tmp/art-duty.html", renderDutyCycleCalculator("MIG").html);
fs.writeFileSync("/tmp/art-trouble.html", renderTroubleshootingFlowchart("porosity").html);
console.log("wrote /tmp/art-polarity.html, /tmp/art-duty.html, /tmp/art-trouble.html");
