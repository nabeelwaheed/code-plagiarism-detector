"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Code2, Hash, Loader2, MessageSquare, ShieldAlert } from "lucide-react";
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
      if (!assignmentId) throw new Error("That assignment is not available.");
      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => setLeftRevealedIdentity(identity),
  });

  const revealRightIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => {
      if (!assignmentId) throw new Error("That assignment is not available.");
      return revealAssignmentSubmissionIdentity(assignmentId, submissionId);
    },
    onSuccess: (identity) => setRightRevealedIdentity(identity),
  });

  useEffect(() => {
    setLeftRevealedIdentity(null);
    setRightRevealedIdentity(null);
    revealLeftIdentityMutation.reset();
    revealRightIdentityMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairQuery.data?.leftSubmission.id, pairQuery.data?.rightSubmission.id]);

  if (pairQuery.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: "0.75rem", color: "var(--text-tertiary)" }}>
        <Loader2 size={20} className="anim-spin" /> Loading pair evidence...
      </div>
    );
  }

  if (pairQuery.error || !pairQuery.data) {
    return (
      <div className="alert alert-error" style={{ margin: "2rem auto", maxWidth: 500 }}>
        {pairQuery.error?.message ?? "That suspicious pair no longer exists."}
      </div>
    );
  }

  const pair = pairQuery.data;
  const similarityPct = pair.similarityScore !== null ? Math.round(pair.similarityScore * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "0.65rem 1rem",
          flexShrink: 0,
        }}
      >
        <Link
          href={`/professor/assignments/${pair.assignment.id}`}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: "0.6rem", padding: "0.25rem 0.5rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
        >
          <ArrowLeft size={15} /> Back to Assignment
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ fontSize: "1.2rem", margin: 0 }}>
              {pair.leftSubmission.displayName}
              <span style={{ color: "var(--text-tertiary)", margin: "0 0.5rem", fontWeight: 400 }}>vs</span>
              {pair.rightSubmission.displayName}
            </h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {pair.assignment.title} &middot; {pair.assignment.language.toUpperCase()}
            </p>
          </div>

          {/* Metric chips */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {similarityPct !== null && (
              <div
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "var(--radius-md)",
                  background: similarityPct >= 35 ? "var(--accent-red-soft)" : "var(--bg-surface-raised)",
                  border: `1px solid ${similarityPct >= 35 ? "rgba(220,38,38,0.25)" : "var(--border-subtle)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <ShieldAlert size={14} color={similarityPct >= 35 ? "var(--accent-red)" : "var(--text-tertiary)"} />
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: similarityPct >= 35 ? "var(--accent-red)" : "var(--text-primary)" }}>
                  {similarityPct}% similar
                </span>
              </div>
            )}
            <div className="stat-tile" style={{ padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Code2 size={13} color="var(--text-tertiary)" />
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{pair.matches.length} regions</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Hash size={13} color="var(--text-tertiary)" />
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{pair.matchedTokenCount} tokens</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <MessageSquare size={13} color="var(--text-tertiary)" />
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{pair.commentMatchCount} comments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Identity panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          padding: "1rem",
          background: "var(--bg-surface-raised)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            padding: "0.85rem",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
            {pair.leftSubmission.displayName}
            <span className={`status-badge ${pair.leftSubmission.kind === "current" ? "badge-open" : "badge-closed"}`} style={{ marginLeft: "0.5rem", fontSize: "0.65rem" }}>
              {pair.leftSubmission.kind}
            </span>
          </div>
          <SubmissionIdentityPanel
            identityRevealMode={pair.leftSubmission.identityRevealMode}
            isRevealPending={revealLeftIdentityMutation.isPending}
            onHide={() => { setLeftRevealedIdentity(null); revealLeftIdentityMutation.reset(); }}
            onReveal={pair.leftSubmission.identityRevealMode ? () => revealLeftIdentityMutation.mutate(pair.leftSubmission.id) : null}
            revealError={revealLeftIdentityMutation.error?.message ?? null}
            revealedIdentity={leftRevealedIdentity}
            showUnavailableMessage
          />
        </div>

        <div
          style={{
            padding: "0.85rem",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
            {pair.rightSubmission.displayName}
            <span className={`status-badge ${pair.rightSubmission.kind === "current" ? "badge-open" : "badge-closed"}`} style={{ marginLeft: "0.5rem", fontSize: "0.65rem" }}>
              {pair.rightSubmission.kind}
            </span>
          </div>
          <SubmissionIdentityPanel
            identityRevealMode={pair.rightSubmission.identityRevealMode}
            isRevealPending={revealRightIdentityMutation.isPending}
            onHide={() => { setRightRevealedIdentity(null); revealRightIdentityMutation.reset(); }}
            onReveal={pair.rightSubmission.identityRevealMode ? () => revealRightIdentityMutation.mutate(pair.rightSubmission.id) : null}
            revealError={revealRightIdentityMutation.error?.message ?? null}
            revealedIdentity={rightRevealedIdentity}
            showUnavailableMessage
          />
        </div>
      </div>

      {/* Evidence viewer */}
      <div style={{ flex: 1, padding: "1rem" }}>
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
      </div>
    </div>
  );
}
