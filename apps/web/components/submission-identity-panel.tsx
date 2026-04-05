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
      <div className="stack-sm">
        <div className="toolbar-row">
          {onHide ? (
            <button className="secondary-button" onClick={onHide} type="button">
              Hide identity
            </button>
          ) : null}
        </div>
        <div className="surface-muted stack-sm">
          <strong>Revealed identity</strong>
          <p>Name: {revealedIdentity.studentName}</p>
          <p>Student number: {revealedIdentity.studentNumber ?? "Not provided"}</p>
          <p>Email: {revealedIdentity.studentEmail ?? "Not provided"}</p>
          {revealedIdentity.assignmentKey ? (
            <p>Assignment keyID: {revealedIdentity.assignmentKey}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!identityRevealMode) {
    return <p className="muted-text">Identity is not available for this submission.</p>;
  }

  return (
    <div className="stack-sm">
      <div className="toolbar-row">
        {onReveal ? (
          <button
            className="secondary-button"
            disabled={isRevealPending}
            onClick={onReveal}
            type="button"
          >
            {isRevealPending ? "Revealing..." : "Reveal identity"}
          </button>
        ) : null}
      </div>
      {revealError ? <p className="error-text">{revealError}</p> : null}
      <p className="muted-text">
        {identityRevealMode === "encrypted"
          ? "This submission stores an encrypted identity that can be revealed only in the professor workflow."
          : "This bulk testing submission reveals the sanitized child zip filename stem as the student name."}
      </p>
    </div>
  );
}
