"use client";

import type { SubmissionIdentityRevealResponse } from "../lib/api";

interface SubmissionIdentityPanelProps {
  identityRevealMode?: "encrypted" | "display_name" | null;
  revealedIdentity: SubmissionIdentityRevealResponse | null;
  isRevealPending?: boolean;
  revealError?: string | null;
  onReveal?: (() => void) | null;
  onHide?: (() => void) | null;
  showUnavailableMessage?: boolean;
}

export function SubmissionIdentityPanel({
  identityRevealMode,
  revealedIdentity,
  isRevealPending = false,
  revealError,
  onReveal,
  onHide,
  showUnavailableMessage = false,
}: SubmissionIdentityPanelProps) {
  if (!identityRevealMode && !revealedIdentity && !showUnavailableMessage) {
    return null;
  }

  if (revealedIdentity) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {onHide && (
          <button className="btn btn-outline btn-sm" onClick={onHide} type="button">
            Hide identity
          </button>
        )}
        <div
          style={{
            padding: "0.75rem",
            background: "var(--bg-surface-raised)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            fontSize: "0.85rem",
          }}
        >
          <strong style={{ fontSize: "0.82rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Revealed Identity
          </strong>
          <p style={{ margin: 0 }}>Name: <strong>{revealedIdentity.studentName}</strong></p>
          <p style={{ margin: 0 }}>Student #: <strong>{revealedIdentity.studentNumber ?? "Not provided"}</strong></p>
          <p style={{ margin: 0 }}>Email: <strong>{revealedIdentity.studentEmail ?? "Not provided"}</strong></p>
          {revealedIdentity.assignmentKey && (
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
              Key: {revealedIdentity.assignmentKey}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!identityRevealMode) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--text-tertiary)", margin: 0 }}>
        Identity is not available for this submission.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {onReveal && (
        <button
          className="btn btn-outline btn-sm"
          disabled={isRevealPending}
          onClick={onReveal}
          type="button"
        >
          {isRevealPending ? "Revealing..." : "Reveal Identity"}
        </button>
      )}
      {revealError && (
        <p style={{ fontSize: "0.82rem", color: "var(--accent-red)", margin: 0 }}>{revealError}</p>
      )}
      <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
        {identityRevealMode === "encrypted"
          ? "This submission stores an encrypted identity that can be revealed by the professor."
          : "This submission reveals the sanitized filename stem as the student name."}
      </p>
    </div>
  );
}
