"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a generated artifact inside a strictly sandboxed iframe (scripts
 * only, no same-origin, no network). The artifact reports its height via
 * postMessage so the frame sizes to its content.
 */
export default function ArtifactFrame({
  html,
  title,
}: {
  html: string;
  title: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(260);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (ref.current && e.source !== ref.current.contentWindow) return;
      const data = e.data as { type?: string; height?: number };
      if (data?.type === "artifact-height" && typeof data.height === "number") {
        setHeight(Math.min(Math.max(data.height + 4, 140), 1400));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="artifact">
      <div className="artifact-title">◆ {title}</div>
      <iframe
        ref={ref}
        title={title}
        srcDoc={html}
        sandbox="allow-scripts"
        style={{ width: "100%", height, border: 0, display: "block" }}
      />
    </div>
  );
}
