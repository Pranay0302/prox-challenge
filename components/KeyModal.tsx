"use client";

import { useState } from "react";

export default function KeyModal({
  open,
  initialKey,
  canClose,
  onSave,
  onClear,
  onClose,
}: {
  open: boolean;
  initialKey: string;
  canClose: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(initialKey);
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => canClose && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Your Anthropic API key</h3>
        <p className="modal-note">
          This demo runs on your own key. It&apos;s stored only in this browser and sent
          with your requests to run the agent, it is never saved or logged on the server.
          Get a key at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="sk-ant-..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onSave(val.trim());
          }}
        />
        <div className="modal-actions">
          {initialKey && (
            <button className="ghost" onClick={onClear}>
              Clear
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canClose && (
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button className="primary" onClick={() => onSave(val.trim())} disabled={!val.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
