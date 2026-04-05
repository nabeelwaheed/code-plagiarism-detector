"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EvidenceViewer } from "./evidence-viewer";
import {
  getPairResult,
  revealAssignmentSubmissionIdentity,
  type SubmissionIdentityRevealResponse,
} from "../lib/api";
import { SubmissionIdentityPanel } from "./submission-identity-panel";

export function PairViewerPanel({ pairId }: { pairId: string }) {
  const [leftRevealedIdentity, setLeftRevealedIdentity] =
    useState<SubmissionIdentityRevealResponse | null>(null);
  const [rightRevealedIdentity, setRightRevealedIdentity] =
    useState<SubmissionIdentityRevealResponse | null>(null);
  const pairQuery = useQuery({
    queryKey: ["pair-result", pairId],
    queryFn: () => getPairResult(pairId),
    refetchInterval: 4000,
  });
  const assignmentId = pairQuery.data?.assignment.id ?? "";

  const revealLeftIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => {
      if (!assignmentId) {
        throw new Error("That assignment is not available.");
      }

      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => {
      setLeftRevealedIdentity(identity);
    },
  });

  const revealRightIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => {
      if (!assignmentId) {
        throw new Error("That assignment is not available.");
      }

      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => {
      setRightRevealedIdentity(identity);
    },
  });

  useEffect(() => {
    setLeftRevealedIdentity(null);
    setRightRevealedIdentity(null);
    revealLeftIdentityMutation.reset();
    revealRightIdentityMutation.reset();
  }, [
    pairQuery.data?.leftSubmission.id,
    pairQuery.data?.rightSubmission.id,
  ]);

  if (pairQuery.isLoading) {
    return <p className="panel">Loading pair evidence...</p>;
  }

  if (pairQuery.error || !pairQuery.data) {
    return <p className="panel error-text">{pairQuery.error?.message ?? "That suspicious pair no longer exists."}</p>;
  }

  const pair = pairQuery.data;

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Pair review</p>
          <h1>
            {pair.leftSubmission.displayName} vs {pair.rightSubmission.displayName}
          </h1>
          <p className="subtle-text">
            Review matched regions for this {pair.assignment.language.toUpperCase()} pair.
          </p>
          <div className="toolbar-row">
            <span className="status-badge is-active">{pair.assignment.language.toUpperCase()}</span>
            <span className="pill">Assignment: {pair.assignment.title}</span>
          </div>
        </div>
        <Link className="secondary-button as-link" href={`/professor/assignments/${pair.assignment.id}`}>
          Back to assignment
        </Link>
      </section>

      <section className="panel">
        <div className="pair-review-layout">
          <div className="pair-review-metrics">
            <div className="metric-card">
              <span>Code similarity</span>
              <strong>{formatSimilarityPercent(pair.similarityScore)}</strong>
            </div>
            <div className="metric-card">
              <span>Matched regions</span>
              <strong>{pair.matches.length}</strong>
            </div>
            <div className="metric-card">
              <span>Matched tokens</span>
              <strong>{pair.matchedTokenCount}</strong>
            </div>
            <div className="metric-card">
              <span>Comment similarity</span>
              <strong>{formatSimilarityPercent(pair.commentScore)}</strong>
            </div>
          </div>

          <div className="pair-identity-grid">
            <div className="surface-muted stack-sm">
              <div className="stack-sm">
                <strong>{pair.leftSubmission.displayName}</strong>
                <span className="pair-note">Left submission identity</span>
              </div>
              <SubmissionIdentityPanel
                identityRevealMode={pair.leftSubmission.identityRevealMode}
                isRevealPending={revealLeftIdentityMutation.isPending}
                onHide={() => {
                  setLeftRevealedIdentity(null);
                  revealLeftIdentityMutation.reset();
                }}
                onReveal={
                  pair.leftSubmission.identityRevealMode
                    ? () => revealLeftIdentityMutation.mutate(pair.leftSubmission.id)
                    : null
                }
                revealError={revealLeftIdentityMutation.error?.message ?? null}
                revealedIdentity={leftRevealedIdentity}
                showUnavailableMessage
              />
            </div>

            <div className="surface-muted stack-sm">
              <div className="stack-sm">
                <strong>{pair.rightSubmission.displayName}</strong>
                <span className="pair-note">Right submission identity</span>
              </div>
              <SubmissionIdentityPanel
                identityRevealMode={pair.rightSubmission.identityRevealMode}
                isRevealPending={revealRightIdentityMutation.isPending}
                onHide={() => {
                  setRightRevealedIdentity(null);
                  revealRightIdentityMutation.reset();
                }}
                onReveal={
                  pair.rightSubmission.identityRevealMode
                    ? () => revealRightIdentityMutation.mutate(pair.rightSubmission.id)
                    : null
                }
                revealError={revealRightIdentityMutation.error?.message ?? null}
                revealedIdentity={rightRevealedIdentity}
                showUnavailableMessage
              />
            </div>
          </div>

          <div className="surface-muted stack-sm">
            <strong>How to review</strong>
            <p className="pair-note">
              Click a highlighted match in either editor, or use the code and comment match buttons
              below, to jump to and highlight the same region on both sides.
            </p>
          </div>

        </div>
        <EvidenceViewer
          language={pair.assignment.language}
          leftSource={pair.leftSubmission.concatenatedSource}
          rightSource={pair.rightSubmission.concatenatedSource}
          matches={pair.matches}
          leftTitle={pair.leftSubmission.displayName}
          rightTitle={pair.rightSubmission.displayName}
          leftLabel={pair.leftSubmission.kind}
          rightLabel={pair.rightSubmission.kind}
        />
      </section>
    </div>
  );
}

function formatSimilarityPercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}
