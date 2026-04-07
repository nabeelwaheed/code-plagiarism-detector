"use client";

import { Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
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
          <span className="status-pill tone-success">
            <ShieldCheck size={12} /> Identity Revealed
          </span>
          {onHide ? (
            <button className="secondary-button button-compact" onClick={onHide} type="button">
              <EyeOff size={13} /> Hide
            </button>
          ) : null}
        </div>
        <div className="identity-list">
          <p><strong>Name:</strong> {revealedIdentity.studentName}</p>
          <p><strong>Student Number:</strong> {revealedIdentity.studentNumber ?? "Not provided"}</p>
          <p><strong>Email:</strong> {revealedIdentity.studentEmail ?? "Not provided"}</p>
          {revealedIdentity.assignmentKey ? (
            <p><strong>Assignment Key:</strong> <span className="mono">{revealedIdentity.assignmentKey}</span></p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!identityRevealMode) {
    return (
      <div className="surface-soft">
        <p className="secondary-text">No identity information available for this submission.</p>
      </div>
    );
  }

  return (
    <div className="identity-card">
      <div className="toolbar-row">
        <span className="status-pill tone-warning">
          <ShieldAlert size={12} /> Identity Hidden
        </span>
        {onReveal ? (
          <button
            className="secondary-button button-compact"
            disabled={isRevealPending}
            onClick={onReveal}
            type="button"
          >
            <Eye size={13} />
            {isRevealPending ? "Revealing..." : "Reveal Identity"}
          </button>
        ) : null}
      </div>
      {revealError ? (
        <div className="error-panel">
          <strong>Could not reveal identity</strong>
          <p>{revealError}</p>
        </div>
      ) : null}
      <p className="secondary-text">
        {identityRevealMode === "encrypted"
          ? "This student's identity is encrypted. Only authorized instructors can decrypt and view it."
          : "This submission was created via batch upload. The filename is used as the visible name."}
      </p>
    </div>
  );
}
