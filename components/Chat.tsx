"use client";

import { useEffect, useRef, useState } from "react";
import { parseSse } from "@/lib/agent/sse";
import type { UIEvent } from "@/lib/agent/ui-events";
import Message, { type UiMessage } from "./Message";
import KeyModal from "./KeyModal";

const SAMPLES = [
  "What's the duty cycle for MIG welding at 200A on 240V?",
  "I'm getting porosity in my flux-cored welds. What should I check?",
  "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?",
];

const KEY_STORAGE = "vulcan_anthropic_key";

export default function Chat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyError, setKeyError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORAGE);
      if (k) setApiKey(k);
    } catch {}
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { hasServerKey?: boolean }) => setHasServerKey(Boolean(d.hasServerKey)))
      .catch(() => setHasServerKey(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // The visitor must supply a key only when the server has none (public deploy).
  const needsKey = hasServerKey === false && !apiKey;

  function openKeyModal() {
    setKeyError("");
    setKeyModalOpen(true);
  }

  // Validate the key server-side (free models-list check) before accepting it.
  async function submitKey(key: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { valid: boolean; error?: string };
      if (data.valid) {
        try {
          localStorage.setItem(KEY_STORAGE, key);
        } catch {}
        setApiKey(key);
        setKeyError("");
        setKeyModalOpen(false);
        return { ok: true };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "Couldn’t reach the server to check the key. Try again." };
    }
  }

  function clearKey() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {}
    setApiKey(null);
    setKeyError("");
    setKeyModalOpen(false);
  }

  function clearChat() {
    setMessages([]);
    setInput("");
  }

  function patchLast(fn: (m: UiMessage) => void) {
    setMessages((cur) => {
      if (cur.length === 0) return cur;
      const copy = cur.slice();
      const last = { ...copy[copy.length - 1] };
      fn(last);
      copy[copy.length - 1] = last;
      return copy;
    });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    if (needsKey) {
      openKeyModal();
      return;
    }
    setInput("");
    setBusy(true);

    const history = messages;
    const userMsg: UiMessage = { role: "user", text: q, events: [] };
    setMessages([...history, userMsg, { role: "assistant", text: "", events: [] }]);

    const apiMessages = [...history, userMsg].map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiKey) headers["x-anthropic-key"] = apiKey;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let stop = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const parsed = parseSse(decoder.decode(value, { stream: true }), buffer);
        buffer = parsed.buffer;
        for (const ev of parsed.events) {
          if (ev.event === "text") {
            const { delta } = ev.data as { delta: string };
            patchLast((m) => {
              m.text += delta;
            });
          } else if (ev.event === "ui") {
            patchLast((m) => {
              m.events = [...m.events, ev.data as UIEvent];
            });
          } else if (ev.event === "error") {
            const { message, code } = ev.data as { message: string; code?: string };
            const isKeyErr =
              code === "missing_key" ||
              /invalid api key|authentication|x-api-key|\b401\b|api key/i.test(message);
            if (isKeyErr) {
              // Roll back the failed attempt, restore the question, prompt for a key.
              setMessages((cur) => {
                const copy = cur.slice();
                if (copy.at(-1)?.role === "assistant") copy.pop();
                if (copy.at(-1)?.role === "user") copy.pop();
                return copy;
              });
              setInput(q);
              setKeyError(
                code === "missing_key"
                  ? "Add your Anthropic API key to start."
                  : "That key was rejected. Please enter a valid Anthropic API key.",
              );
              setKeyModalOpen(true);
              stop = true;
            } else {
              patchLast((m) => {
                m.text += `${m.text ? "\n\n" : ""}⚠️ ${message}`;
              });
            }
          }
        }
        if (stop) {
          try {
            await reader.cancel();
          } catch {}
          break;
        }
      }
    } catch (e) {
      patchLast((m) => {
        m.text += `${m.text ? "\n\n" : ""}⚠️ ${(e as Error).message}`;
      });
    } finally {
      setBusy(false);
    }
  }

  const keyLabel = apiKey ? "API key ✓" : hasServerKey ? "Use your key" : "Add API key";

  return (
    <div className="app">
      <header className="brand">
        <div className="brand-row">
          <h1>OmniPro&nbsp;220 Assistant</h1>
          <div className="brand-actions">
            {messages.length > 0 && (
              <button className="key-btn" onClick={clearChat}>
                Clear chat
              </button>
            )}
            <button className="key-btn" onClick={openKeyModal}>
              {keyLabel}
            </button>
          </div>
        </div>
        <p>Expert help for your Vulcan OmniPro 220 welder with diagrams, manual pages, and interactive tools.</p>
      </header>

      <div className="messages">
        {messages.length === 0 &&
          (needsKey ? (
            <div className="key-gate">
              <p className="empty-lead">Add your Anthropic API key to start asking questions.</p>
              <button className="primary" onClick={openKeyModal}>
                Add API key
              </button>
              <p className="key-gate-note">
                Your key stays in your browser and is used only to run your requests.
              </p>
            </div>
          ) : (
            <div className="empty">
              <p className="empty-lead">Ask about setup, settings, duty cycle, polarity, or weld problems.</p>
              <div className="samples">
                {SAMPLES.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        {messages.map((m, i) => (
          <Message key={i} m={m} />
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask about your OmniPro 220…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? "…" : "Ask"}
        </button>
      </form>

      <KeyModal
        open={keyModalOpen}
        initialKey={apiKey ?? ""}
        canClose={!needsKey}
        initialError={keyError}
        onSubmit={submitKey}
        onClear={clearKey}
        onClose={() => setKeyModalOpen(false)}
      />
    </div>
  );
}
