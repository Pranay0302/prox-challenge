import { runAgent, type ChatMessage } from "@/lib/agent/run";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { encodeSse } from "@/lib/agent/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60s is the Vercel Hobby ceiling; Pro can raise this to 300 for long answers.
export const maxDuration = 60;

const DEFAULT_MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  let messages: ChatMessage[];
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages required");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Bring-your-own-key: the visitor's key (header) wins; otherwise fall back to
  // a server key from .env (local dev). The key is used only to run this
  // request's agent and is never logged or persisted.
  const headerKey = req.headers.get("x-anthropic-key")?.trim();
  const apiKey = headerKey || process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.AGENT_MODEL || DEFAULT_MODEL;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encodeSse({ event, data })));
      try {
        if (!apiKey) {
          send("error", {
            code: "missing_key",
            message: "No Anthropic API key. Add your key to start asking questions.",
          });
          return;
        }
        const kb = loadKnowledgeBase();
        for await (const item of runAgent({
          messages,
          kb,
          env: { anthropicApiKey: apiKey, model },
        })) {
          if (item.type === "text") send("text", { delta: item.text });
          else if (item.type === "ui") send("ui", item.event);
          else if (item.type === "error") send("error", { message: item.message });
          else if (item.type === "done") send("done", {});
        }
      } catch (err) {
        send("error", { message: (err as Error)?.message ?? "Server error." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
