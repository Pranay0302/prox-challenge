export interface SseEvent {
  event: string;
  data: unknown;
}

/** Encodes one Server-Sent Event frame. */
export function encodeSse(e: SseEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/**
 * Parses SSE frames from a streamed chunk, carrying an incomplete tail in
 * `buffer` across calls. Isomorphic — used by both the API route and the
 * browser client.
 */
export function parseSse(
  chunk: string,
  buffer: string,
): { events: SseEvent[]; buffer: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: SseEvent[] = [];

  for (const block of parts) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    if (dataLines.length === 0) continue;
    try {
      events.push({ event, data: JSON.parse(dataLines.join("\n")) });
    } catch {
      // ignore malformed frame
    }
  }
  return { events, buffer: rest };
}
