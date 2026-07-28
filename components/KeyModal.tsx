"use client";

import { useEffect, useState } from "react";

export default function KeyModal({
  open,
  initialKey,
  canClose,
  initialError,
  onSubmit,
  onClear,
  onClose,
}: {
  open: boolean;
  initialKey: string;
  canClose: boolean;
  initialError?: string;
  /** Validates + persists the key; resolves ok:false with a message to show inline. */
  onSubmit: (key: string) => Promise<{ ok: boolean; error?: string }>;
  onClear: () => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(initialKey);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(initialError ?? "");

  useEffect(() => {
    if (open) setError(initialError ?? "");
  }, [open, initialError]);

  if (!open) return null;

  async function submit() {
    const k = val.trim();
    if (!k || checking) return;
    setChecking(true);
    setError("");
    const res = await onSubmit(k);
    setChecking(false);
    if (!res.ok) setError(res.error ?? "That key wasn’t accepted.");
    // On success the parent closes the modal.
  }

  return (
    <div className="modal-backdrop" onClick={() => canClose && !checking && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Your Anthropic API key</h3>
        <p className="modal-note">
          This demo runs on your own key. It&apos;s stored only in this browser and sent
          with your requests to run the agent — it is never saved or logged on the server.
          Get a key at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <input
          type="password"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            if (error) setError("");
          }}
          placeholder="sk-ant-..."
          autoFocus
          disabled={checking}
          aria-invalid={error ? true : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          {initialKey && (
            <button className="ghost" onClick={onClear} disabled={checking}>
              Clear
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canClose && (
            <button className="ghost" onClick={onClose} disabled={checking}>
              Cancel
            </button>
          )}
          <button className="primary" onClick={submit} disabled={checking || !val.trim()}>
            {checking ? "Checking…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
