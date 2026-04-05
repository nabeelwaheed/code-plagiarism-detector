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
      <div className="identity-card">
        <div className="toolbar-row">
          <span className="status-pill tone-success">Identity revealed</span>
          {onHide ? (
            <button className="secondary-button button-compact" onClick={onHide} type="button">
              Hide identity
            </button>
          ) : null}
        </div>
        <div className="identity-list">
          <p><strong>Name:</strong> {revealedIdentity.studentName}</p>
          <p><strong>Student number:</strong> {revealedIdentity.studentNumber ?? "Not provided"}</p>
          <p><strong>Email:</strong> {revealedIdentity.studentEmail ?? "Not provided"}</p>
          {revealedIdentity.assignmentKey ? (
            <p><strong>Assignment keyID:</strong> {revealedIdentity.assignmentKey}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!identityRevealMode) {
    return (
      <div className="surface-soft">
        <p className="secondary-text">Identity is not available for this submission.</p>
      </div>
    );
  }

  return (
    <div className="identity-card">
      <div className="toolbar-row">
        <span className="status-pill tone-warning">Identity hidden</span>
        {onReveal ? (
          <button
            className="secondary-button button-compact"
            disabled={isRevealPending}
            onClick={onReveal}
            type="button"
          >
            {isRevealPending ? "Revealing..." : "Reveal identity"}
          </button>
        ) : null}
      </div>
      {revealError ? (
        <div className="error-panel">
          <strong>Reveal failed</strong>
          <p>{revealError}</p>
        </div>
      ) : null}
      <p className="secondary-text">
        {identityRevealMode === "encrypted"
          ? "This submission stores an encrypted identity that can only be revealed in the professor workflow."
          : "This bulk-created submission reveals the sanitized child zip filename stem as the student name."}
      </p>
    </div>
  );
}
