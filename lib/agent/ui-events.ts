import type { DocSlug } from "../kb/types";

/**
 * A side-channel event a tool surfaces to the browser (in addition to the
 * short text result the model reads). Lets the agent *show* images and
 * interactive artifacts without emitting large HTML into its own text.
 */
export type UIEvent =
  | { type: "image"; doc: DocSlug; page: number; src: string; caption?: string }
  | { type: "artifact"; kind: string; title: string; html: string }
  | { type: "citation"; doc: DocSlug; page: number; label: string };

export interface Emitter {
  emit(event: UIEvent): void;
  /** Returns buffered events and clears the buffer. */
  drain(): UIEvent[];
}

/** A request-scoped buffer of UI events produced by tool calls. */
export function createEmitter(): Emitter {
  let buffer: UIEvent[] = [];
  return {
    emit(event) {
      buffer.push(event);
    },
    drain() {
      const out = buffer;
      buffer = [];
      return out;
    },
  };
}
