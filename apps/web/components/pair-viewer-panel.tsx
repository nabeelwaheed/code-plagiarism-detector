"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, MessageSquare, Layers, Hash, Eye, EyeOff, ShieldCheck } from "lucide-react";
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

export function PairViewerPanel({ pairId }: { pairId: string }) {
  const [identitiesVisible, setIdentitiesVisible] = useState(true);
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
        throw new Error("Assignment is not available.");
      }

      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => setLeftRevealedIdentity(identity),
  });

  const revealRightIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => {
      if (!assignmentId) {
        throw new Error("Assignment is not available.");
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
          <strong>Loading comparison</strong>
          <p className="secondary-text">Fetching matched code evidence.</p>
        </div>
      </div>
    );
  }

  if (pairQuery.error || !pairQuery.data) {
    return (
      <section className="error-panel">
        <strong>Comparison not found</strong>
        <p>{pairQuery.error?.message ?? "This pair may have been removed or is no longer available."}</p>
      </section>
    );
  }

  const pair = pairQuery.data;
  const reviewPriority = Math.max(pair.similarityScore, pair.commentScore ?? 0);
  const leftIdentityLabel = identitiesVisible
    ? leftRevealedIdentity?.studentName ?? pair.leftSubmission.displayName
    : "Submission A";
  const rightIdentityLabel = identitiesVisible
    ? rightRevealedIdentity?.studentName ?? pair.rightSubmission.displayName
    : "Submission B";

  return (
    <div className="review-page fade-up">
      {/* ─── Review Header ─── */}
      <section className="review-header">
        <div className="review-header-top">
          <div className="card-stack">
            <div className="toolbar-row">
              <Link className="secondary-button as-link" href={`/professor/assignments/${pair.assignment.id}`}>
                <ArrowLeft size={14} /> Back to Assignment
              </Link>
              <span className="status-pill tone-brand">{formatLanguageLabel(pair.assignment.language)}</span>
              <span className={`status-pill tone-${getRiskTone(reviewPriority)}`}>
                {getRiskLabel(reviewPriority)}
              </span>
              <button
                className="secondary-button button-compact"
                type="button"
                onClick={() => setIdentitiesVisible((value) => !value)}
              >
                {identitiesVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {identitiesVisible ? "Hide identities" : "Reveal identities"}
              </button>
            </div>
            <div className="stack-sm">
              <p className="eyebrow">Code Comparison</p>
              <h1 className="page-title">
                {leftIdentityLabel} vs {rightIdentityLabel}
              </h1>
              <p className="secondary-text">
                Review matched code regions side by side. Use the match navigator to move through evidence and toggle identities when you need a cleaner review view.
              </p>
            </div>
          </div>

          <div className="comparison-metrics">
            <div className="metric-card">
              <span><BarChart3 size={14} style={{ verticalAlign: "-2px" }} /> Code Similarity</span>
              <strong>{formatSimilarityPercent(pair.similarityScore)}</strong>
            </div>
            <div className="metric-card">
              <span><MessageSquare size={14} style={{ verticalAlign: "-2px" }} /> Comment Similarity</span>
              <strong>{formatSimilarityPercent(pair.commentScore)}</strong>
            </div>
            <div className="metric-card">
              <span><Layers size={14} style={{ verticalAlign: "-2px" }} /> Matched Regions</span>
              <strong>{pair.matches.length}</strong>
            </div>
            <div className="metric-card">
              <span><Hash size={14} style={{ verticalAlign: "-2px" }} /> Matched Tokens</span>
              <strong>{pair.matchedTokenCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Code Comparison & Sidebar ─── */}
      <div className="review-layout">
        <section className="review-main">
          <EvidenceViewer
            language={pair.assignment.language}
            leftFiles={pair.leftSubmission.files}
            leftLabel={pair.leftSubmission.kind}
            leftSource={pair.leftSubmission.concatenatedSource}
            leftTitle={leftIdentityLabel}
            matches={pair.matches}
            rightFiles={pair.rightSubmission.files}
            rightLabel={pair.rightSubmission.kind}
            rightSource={pair.rightSubmission.concatenatedSource}
            rightTitle={rightIdentityLabel}
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
                <span>Left Submission</span>
                <strong>{leftIdentityLabel}</strong>
              </div>
              <div className="detail-item">
                <span>Right Submission</span>
                <strong>{rightIdentityLabel}</strong>
              </div>
            </div>
          </section>

          <PairIdentityCard
            heading="Left Identity"
            identitiesVisible={identitiesVisible}
            identityLabel={pair.leftSubmission.displayName}
            identityRevealMode={pair.leftSubmission.identityRevealMode}
            isRevealPending={revealLeftIdentityMutation.isPending}
            loadError={revealLeftIdentityMutation.error?.message ?? null}
            onLoadDetails={
              pair.leftSubmission.identityRevealMode
                ? () => revealLeftIdentityMutation.mutate(pair.leftSubmission.id)
                : null
            }
            revealedIdentity={leftRevealedIdentity}
          />

          <PairIdentityCard
            heading="Right Identity"
            identitiesVisible={identitiesVisible}
            identityLabel={pair.rightSubmission.displayName}
            identityRevealMode={pair.rightSubmission.identityRevealMode}
            isRevealPending={revealRightIdentityMutation.isPending}
            loadError={revealRightIdentityMutation.error?.message ?? null}
            onLoadDetails={
              pair.rightSubmission.identityRevealMode
                ? () => revealRightIdentityMutation.mutate(pair.rightSubmission.id)
                : null
            }
            revealedIdentity={rightRevealedIdentity}
          />
        </aside>
      </div>
    </div>
  );
}

function PairIdentityCard({
  heading,
  identitiesVisible,
  identityLabel,
  identityRevealMode,
  isRevealPending,
  loadError,
  onLoadDetails,
  revealedIdentity,
}: {
  heading: string;
  identitiesVisible: boolean;
  identityLabel: string;
  identityRevealMode?: "encrypted" | "display_name" | null;
  isRevealPending: boolean;
  loadError: string | null;
  onLoadDetails: (() => void) | null;
  revealedIdentity: SubmissionIdentityRevealResponse | null;
}) {
  return (
    <section className="review-sidebar-card">
      <div className="stack-xs">
        <p className="eyebrow">{heading}</p>
        <h3 className="card-title">{identitiesVisible ? identityLabel : "Hidden for review"}</h3>
      </div>

      {identitiesVisible ? (
        <div className="identity-card">
          <div className="toolbar-row">
            <span className="status-pill tone-success">
              <ShieldCheck size={12} /> Identities Visible
            </span>
            {identityRevealMode === "encrypted" && !revealedIdentity && onLoadDetails ? (
              <button
                className="secondary-button button-compact"
                disabled={isRevealPending}
                onClick={onLoadDetails}
                type="button"
              >
                {isRevealPending ? "Loading..." : "Load secure details"}
              </button>
            ) : null}
          </div>

          {loadError ? (
            <div className="error-panel">
              <strong>Could not load secure details</strong>
              <p>{loadError}</p>
            </div>
          ) : null}

          <div className="identity-list">
            <p><strong>Visible Name:</strong> {revealedIdentity?.studentName ?? identityLabel}</p>
            <p><strong>Student Number:</strong> {revealedIdentity?.studentNumber ?? (identityRevealMode === "encrypted" ? "Available after secure reveal" : "Not provided")}</p>
            <p><strong>Email:</strong> {revealedIdentity?.studentEmail ?? (identityRevealMode === "encrypted" ? "Available after secure reveal" : "Not provided")}</p>
            {revealedIdentity?.assignmentKey ? (
              <p><strong>Assignment Key:</strong> <span className="mono">{revealedIdentity.assignmentKey}</span></p>
            ) : null}
          </div>

          <p className="secondary-text" style={{ margin: 0 }}>
            {identityRevealMode === "encrypted"
              ? "This submission keeps detailed identity metadata behind a secure reveal step, while still showing the review label by default."
              : "This review is showing the submission label directly, so you can orient yourself without extra steps."}
          </p>
        </div>
      ) : (
        <div className="identity-card">
          <div className="toolbar-row">
            <span className="status-pill tone-neutral">
              <EyeOff size={12} /> Identities Hidden
            </span>
          </div>
          <p className="secondary-text" style={{ margin: 0 }}>
            Identity labels and metadata are hidden on screen. Use the reveal control above whenever you want to restore names and identifiers.
          </p>
        </div>
      )}
    </section>
  );
}
