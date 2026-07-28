/** Temporary live check of the agent runner. Run: tsx scripts/ask.ts "question" */
import fs from "node:fs";
import { runAgent } from "../lib/agent/run.js";
import { loadKnowledgeBase } from "../lib/kb/load.js";
import { readEnv } from "../lib/env.js";

function loadEnv() {
  const p = process as unknown as { loadEnvFile?: (f?: string) => void };
  try {
    if (typeof p.loadEnvFile === "function") return p.loadEnvFile(".env");
  } catch {}
  try {
    for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

async function main() {
  loadEnv();
  const kb = loadKnowledgeBase();
  const env = readEnv();
  const question =
    process.argv.slice(2).join(" ") ||
    "What's the duty cycle for MIG welding at 200A on 240V?";
  console.log("Q:", question, "\n");

  for await (const item of runAgent({ messages: [{ role: "user", content: question }], kb, env })) {
    if (item.type === "text") process.stdout.write(item.text);
    else if (item.type === "ui") {
      const e = item.event;
      const detail = e.type === "artifact" ? e.kind : e.type === "image" ? e.src : "";
      console.log(`\n  [UI » ${e.type}: ${detail}]`);
    } else if (item.type === "error") console.error("\n  ERROR:", item.message);
    else if (item.type === "done") console.log("\n\n[done]");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
