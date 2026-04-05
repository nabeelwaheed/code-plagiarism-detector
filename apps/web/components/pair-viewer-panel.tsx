"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { EvidenceViewer } from "./evidence-viewer";
import { getPairResult } from "../lib/api";

export function PairViewerPanel({ pairId }: { pairId: string }) {
  const pairQuery = useQuery({
    queryKey: ["pair-result", pairId],
    queryFn: () => getPairResult(pairId),
    refetchInterval: 4000,
  });

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
