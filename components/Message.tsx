"use client";

import Markdown from "react-markdown";
import type { UIEvent } from "@/lib/agent/ui-events";
import ArtifactFrame from "./ArtifactFrame";

export interface UiMessage {
  role: "user" | "assistant";
  text: string;
  events: UIEvent[];
}

export default function Message({ m }: { m: UiMessage }) {
  return (
    <div className={`msg ${m.role}`}>
      <div className="bubble">
        {m.role === "assistant" && <div className="who">Assistant</div>}
        {m.text ? (
          <div className="prose">
            <Markdown>{m.text}</Markdown>
          </div>
        ) : (
          <div className="typing" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        )}
        {m.events.map((e, i) => {
          if (e.type === "image") {
            return (
              <figure className="manual-img" key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.src} alt={e.caption ?? "Manual page"} />
                {e.caption && <figcaption>{e.caption}</figcaption>}
              </figure>
            );
          }
          if (e.type === "artifact") {
            return <ArtifactFrame key={i} title={e.title} html={e.html} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}
