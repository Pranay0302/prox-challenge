import { describe, it, expect } from "vitest";
import { encodeSse, parseSse } from "../sse";

describe("SSE framing", () => {
  it("round-trips a single event", () => {
    const frame = encodeSse({ event: "text", data: { delta: "hi" } });
    const { events, buffer } = parseSse(frame, "");
    expect(events).toEqual([{ event: "text", data: { delta: "hi" } }]);
    expect(buffer).toBe("");
  });

  it("reassembles an event split across two chunks", () => {
    const frame = encodeSse({ event: "ui", data: { type: "image", page: 16 } });
    const mid = Math.floor(frame.length / 2);
    const r1 = parseSse(frame.slice(0, mid), "");
    expect(r1.events).toHaveLength(0);
    const r2 = parseSse(frame.slice(mid), r1.buffer);
    expect(r2.events).toEqual([{ event: "ui", data: { type: "image", page: 16 } }]);
  });

  it("parses multiple events in one chunk and keeps a partial tail", () => {
    const a = encodeSse({ event: "text", data: { delta: "a" } });
    const b = encodeSse({ event: "text", data: { delta: "b" } });
    const partial = "event: text\ndata: {";
    const { events, buffer } = parseSse(a + b + partial, "");
    expect(events).toHaveLength(2);
    expect(buffer).toBe(partial);
  });
});
