import { query } from "@anthropic-ai/claude-agent-sdk";
import type { KnowledgeBase } from "../kb/types";
import type { AppEnv } from "../env";
import { buildSystemPrompt } from "./system-prompt";
import { buildToolServer, VULCAN_TOOL_NAMES } from "./tools";
import { createEmitter, type UIEvent } from "./ui-events";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentStreamItem =
  | { type: "text"; text: string }
  | { type: "ui"; event: UIEvent }
  | { type: "done" }
  | { type: "error"; message: string };

/** Flattens conversation history into a single prompt (stateless per request). */
function buildPrompt(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  if (messages.length <= 1) return last?.content ?? "";
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return `Conversation so far:\n${history}\n\nUser's new message: ${last.content}`;
}

/**
 * Runs the Claude Agent SDK query loop and yields a merged stream of assistant
 * text and UI events (images/artifacts) produced by tool calls, in order.
 */
export async function* runAgent(opts: {
  messages: ChatMessage[];
  kb: KnowledgeBase;
  env: AppEnv;
}): AsyncGenerator<AgentStreamItem> {
  const emitter = createEmitter();
  const server = buildToolServer(opts.kb, emitter);
  const systemPrompt = buildSystemPrompt(opts.kb);

  try {
    const q = query({
      prompt: buildPrompt(opts.messages),
      options: {
        model: opts.env.model,
        systemPrompt,
        mcpServers: { vulcan: server },
        allowedTools: VULCAN_TOOL_NAMES,
        // Per-request key (BYOK). `env` REPLACES the subprocess environment, so
        // spread process.env to keep PATH/HOME, then override the API key.
        env: { ...process.env, ANTHROPIC_API_KEY: opts.env.anthropicApiKey },
        // Auto-allow our tools; deny the SDK's built-in filesystem/bash tools.
        canUseTool: async (toolName: string, input: Record<string, unknown>) =>
          toolName.startsWith("mcp__vulcan__")
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: `Tool ${toolName} is not available here.` },
        maxTurns: 12,
      },
    });

    for await (const msg of q as AsyncIterable<Record<string, unknown>>) {
      // Surface UI events from tools that ran before this message, in order.
      for (const e of emitter.drain()) yield { type: "ui", event: e };

      if (msg.type === "assistant") {
        const blocks =
          ((msg.message as { content?: Array<{ type: string; text?: string }> })
            ?.content) ?? [];
        for (const b of blocks) {
          if (b.type === "text" && b.text) yield { type: "text", text: b.text };
        }
      }
    }

    for (const e of emitter.drain()) yield { type: "ui", event: e };
    yield { type: "done" };
  } catch (err) {
    yield { type: "error", message: (err as Error)?.message ?? "Agent error" };
  }
}
