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
import {
  formatLanguageLabel,
  formatSimilarityPercent,
  getRiskLabel,
  getRiskTone,
} from "../lib/view-models";
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
    onSuccess: (identity) => setLeftRevealedIdentity(identity),
  });

  const revealRightIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => {
      if (!assignmentId) {
        throw new Error("That assignment is not available.");
      }

      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => setRightRevealedIdentity(identity),
  });

  useEffect(() => {
    setLeftRevealedIdentity(null);
    setRightRevealedIdentity(null);
    revealLeftIdentityMutation.reset();
    revealRightIdentityMutation.reset();
  }, [pairQuery.data?.leftSubmission.id, pairQuery.data?.rightSubmission.id]);

  if (pairQuery.isLoading) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <strong>Loading reviewer workspace</strong>
          <p className="secondary-text">Fetching pair detail and evidence spans.</p>
        </div>
      </div>
    );
  }

  if (pairQuery.error || !pairQuery.data) {
    return (
      <section className="error-panel">
        <strong>Pair detail unavailable</strong>
        <p>{pairQuery.error?.message ?? "That suspicious pair no longer exists."}</p>
      </section>
    );
  }

  const pair = pairQuery.data;
  const reviewPriority = Math.max(pair.similarityScore, pair.commentScore ?? 0);

  return (
    <div className="review-page fade-up">
      <section className="review-header">
        <div className="review-header-top">
          <div className="card-stack">
            <div className="toolbar-row">
              <Link className="secondary-button as-link" href={`/professor/assignments/${pair.assignment.id}`}>
                Back to assignment
              </Link>
              <span className="status-pill tone-brand">{formatLanguageLabel(pair.assignment.language)}</span>
              <span className={`status-pill tone-${getRiskTone(reviewPriority)}`}>
                {getRiskLabel(reviewPriority)}
              </span>
            </div>
            <div className="stack-sm">
              <p className="eyebrow">Pair Reviewer</p>
              <h1 className="page-title">
                {pair.leftSubmission.displayName} vs {pair.rightSubmission.displayName}
              </h1>
              <p className="secondary-text">
                Review explicit code and comment evidence for this suspicious pair. Clicking a match
                or highlighted span still jumps both sides.
              </p>
            </div>
          </div>

          <div className="comparison-metrics">
            <div className="metric-card">
              <span>Code similarity</span>
              <strong>{formatSimilarityPercent(pair.similarityScore)}</strong>
            </div>
            <div className="metric-card">
              <span>Comment similarity</span>
              <strong>{formatSimilarityPercent(pair.commentScore)}</strong>
            </div>
            <div className="metric-card">
              <span>Matched regions</span>
              <strong>{pair.matches.length}</strong>
            </div>
            <div className="metric-card">
              <span>Matched tokens</span>
              <strong>{pair.matchedTokenCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="review-layout">
        <section className="review-main">
          <EvidenceViewer
            language={pair.assignment.language}
            leftFiles={pair.leftSubmission.files}
            leftLabel={pair.leftSubmission.kind}
            leftSource={pair.leftSubmission.concatenatedSource}
            leftTitle={pair.leftSubmission.displayName}
            matches={pair.matches}
            rightFiles={pair.rightSubmission.files}
            rightLabel={pair.rightSubmission.kind}
            rightSource={pair.rightSubmission.concatenatedSource}
            rightTitle={pair.rightSubmission.displayName}
          />
        </section>

        <aside className="review-sidebar">
          <section className="review-sidebar-card">
            <div className="stack-xs">
              <p className="eyebrow">Assignment</p>
              <h2 className="card-title">{pair.assignment.title}</h2>
            </div>
            <div className="detail-list">
              <div className="detail-item">
                <span>Left submission</span>
                <strong>{pair.leftSubmission.displayName}</strong>
              </div>
              <div className="detail-item">
                <span>Right submission</span>
                <strong>{pair.rightSubmission.displayName}</strong>
              </div>
            </div>
          </section>

          <section className="review-sidebar-card">
            <div className="stack-xs">
              <p className="eyebrow">Left identity</p>
              <h3 className="card-title">{pair.leftSubmission.displayName}</h3>
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
          </section>

          <section className="review-sidebar-card">
            <div className="stack-xs">
              <p className="eyebrow">Right identity</p>
              <h3 className="card-title">{pair.rightSubmission.displayName}</h3>
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
          </section>
        </aside>
      </div>
    </div>
  );
}
