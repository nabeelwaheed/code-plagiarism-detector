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
          <p className="eyebrow">{pair.assignment.language.toUpperCase()} Pair Review</p>
          <h1>
            {pair.leftSubmission.displayName} vs {pair.rightSubmission.displayName}
          </h1>
          <p>
            Similarity {pair.similarityScore.toFixed(3)} with {pair.matches.length} matched regions.
          </p>
        </div>
        <Link className="secondary-button as-link" href={`/professor/assignments/${pair.assignment.id}`}>
          Back to assignment
        </Link>
      </section>

      <section className="panel">
        <EvidenceViewer
          language={pair.assignment.language}
          leftSource={pair.leftSubmission.concatenatedSource}
          rightSource={pair.rightSubmission.concatenatedSource}
          matches={pair.matches}
        />
      </section>
    </div>
  );
}
