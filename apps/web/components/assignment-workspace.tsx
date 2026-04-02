"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  createComparisonRun,
  getAssignment,
  getUploadBatch,
  uploadProfessorArchive,
} from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

export function AssignmentWorkspace({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [trackedUploadBatchId, setTrackedUploadBatchId] = useState<string | null>(null);
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<"submissions" | "pairs">(
    "submissions",
  );
  const currentUserQuery = useCurrentUserQuery();
  const session = currentUserQuery.data ?? null;

  const assignmentQuery = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => getAssignment(assignmentId),
    refetchInterval: 4000,
  });

  const trackedUploadQuery = useQuery({
    queryKey: ["upload-batch", trackedUploadBatchId],
    queryFn: () => getUploadBatch(trackedUploadBatchId!),
    enabled: Boolean(trackedUploadBatchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : 3000;
    },
  });

  const historicalUploadMutation = useMutation({
    mutationFn: () =>
      uploadProfessorArchive({
        assignmentId,
        purpose: "historical_submission",
        file: historicalFile!,
      }),
    onSuccess: (batch) => {
      setTrackedUploadBatchId(batch.id);
      setHistoricalFile(null);
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
  });

  const templateUploadMutation = useMutation({
    mutationFn: () =>
      uploadProfessorArchive({
        assignmentId,
        purpose: "template_upload",
        file: templateFile!,
      }),
    onSuccess: (batch) => {
      setTrackedUploadBatchId(batch.id);
      setTemplateFile(null);
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => createComparisonRun(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
  });

  const latestCompletedRun = useMemo(
    () =>
      assignmentQuery.data?.comparisonRuns.find(
        (run) => run.status === "completed" && run.pairResults.length > 0,
      ) ?? assignmentQuery.data?.comparisonRuns[0],
    [assignmentQuery.data],
  );

  const handleHistoricalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!historicalFile || !session) {
      return;
    }
    historicalUploadMutation.mutate();
  };

  const handleTemplateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateFile || !session) {
      return;
    }
    templateUploadMutation.mutate();
  };

  if (!session) {
    return <p className="panel">Sign in as a professor to open this assignment workspace.</p>;
  }

  if (session.role !== "professor") {
    return <p className="panel">Only professor accounts can view assignment workspaces.</p>;
  }

  if (assignmentQuery.isLoading) {
    return <p className="panel">Loading assignment...</p>;
  }

  if (assignmentQuery.error || !assignmentQuery.data) {
    return <p className="panel error-text">{assignmentQuery.error?.message ?? "That assignment no longer exists."}</p>;
  }

  const assignment = assignmentQuery.data;
  const currentSubmissions = assignment.submissions.filter((item) => item.kind === "current");
  const historicalSubmissions = assignment.submissions.filter((item) => item.kind === "historical");
  const currentVsCurrentPairs = latestCompletedRun?.pairResults.filter(
    (pair) => pair.leftSubmission.kind === "current" && pair.rightSubmission.kind === "current",
  ) ?? [];
  const currentVsHistoricalPairs = latestCompletedRun?.pairResults.filter(
    (pair) =>
      (pair.leftSubmission.kind === "current" && pair.rightSubmission.kind === "historical")
      || (pair.leftSubmission.kind === "historical" && pair.rightSubmission.kind === "current"),
  ) ?? [];

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">{assignment.language.toUpperCase()} Assignment</p>
          <h1>{assignment.title}</h1>
          <p>
            Student submissions join this assignment through the public keyID. Historical archives
            and template code are prepared separately and fed into the comparison flow automatically.
          </p>
        </div>
        <div className="hero-meta">
          <span className="pill">{assignment.keys[0]?.publicKey ?? "No key"}</span>
          <button
            className="secondary-button"
            disabled={rerunMutation.isPending}
            onClick={() => rerunMutation.mutate()}
            type="button"
          >
            {rerunMutation.isPending ? "Queueing..." : "Run comparison now"}
          </button>
          {rerunMutation.error ? (
            <p className="error-text" style={{ width: "100%", margin: 0 }}>
              {rerunMutation.error.message}
            </p>
          ) : null}
        </div>
      </section>

      <div className="split-grid">
        <section className="panel">
          <h2>Historical Upload</h2>
          <form className="form-stack" onSubmit={handleHistoricalSubmit}>
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setHistoricalFile(event.target.files?.[0] ?? null)}
            />
            <button
              className="primary-button"
              disabled={!historicalFile || historicalUploadMutation.isPending}
              type="submit"
            >
              {historicalUploadMutation.isPending ? "Uploading..." : "Upload historical archive"}
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Template Upload</h2>
          <form className="form-stack" onSubmit={handleTemplateSubmit}>
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
            />
            <button
              className="primary-button"
              disabled={!templateFile || templateUploadMutation.isPending}
              type="submit"
            >
              {templateUploadMutation.isPending ? "Uploading..." : "Upload template archive"}
            </button>
          </form>
        </section>
      </div>

      {trackedUploadQuery.data ? (
        <section className="panel">
          <p className="eyebrow">Latest processed upload</p>
          <p>
            {trackedUploadQuery.data.purpose} is currently <strong>{trackedUploadQuery.data.status}</strong>.
          </p>
          {trackedUploadQuery.data.errorMessage ? (
            <p className="error-text">{trackedUploadQuery.data.errorMessage}</p>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="hero-meta">
          <button
            className={activeWorkspaceView === "submissions" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveWorkspaceView("submissions")}
            type="button"
          >
            Submissions
          </button>
          <button
            className={activeWorkspaceView === "pairs" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveWorkspaceView("pairs")}
            type="button"
          >
            Suspicious pairs
          </button>
        </div>
      </section>

      {activeWorkspaceView === "submissions" ? (
        <>
          <section className="panel">
            <h2>Prepared artifacts</h2>
            <div className="stats-row">
              <div className="stat-card">
                <span>Current submissions</span>
                <strong>{currentSubmissions.length}</strong>
              </div>
              <div className="stat-card">
                <span>Historical submissions</span>
                <strong>{historicalSubmissions.length}</strong>
              </div>
              <div className="stat-card">
                <span>Active template</span>
                <strong>{assignment.activeTemplate ? 1 : 0}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Upload history</h2>
            <ul className="compact-list">
              {assignment.uploadBatches.map((batch) => (
                <li key={batch.id}>
                  {batch.purpose} · {batch.status}
                  {batch.errorMessage ? ` · ${batch.errorMessage}` : ""}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Suspicious pairs</h2>
          {latestCompletedRun ? (
            <>
              <p>
                Showing run <strong>{latestCompletedRun.id}</strong> with status{" "}
                <strong>{latestCompletedRun.status}</strong>.
              </p>

              <h3>Current vs current</h3>
              {currentVsCurrentPairs.length > 0 ? (
                <div className="pair-table">
                  <div className="pair-table-head">
                    <span>Left</span>
                    <span>Right</span>
                    <span>Similarity</span>
                    <span>Matches</span>
                    <span>Viewer</span>
                  </div>
                  {currentVsCurrentPairs.map((pair) => (
                    <div className="pair-table-row" key={pair.id}>
                      <span>{pair.leftSubmission.displayName}</span>
                      <span>{pair.rightSubmission.displayName}</span>
                      <span>{pair.similarityScore.toFixed(3)}</span>
                      <span>{pair.matchCount}</span>
                      <Link className="text-link" href={`/professor/assignments/${assignment.id}/pairs/${pair.id}`}>
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No current vs current pairs in this run.</p>
              )}

              <h3>Current vs historical</h3>
              {currentVsHistoricalPairs.length > 0 ? (
                <div className="pair-table">
                  <div className="pair-table-head">
                    <span>Left</span>
                    <span>Right</span>
                    <span>Similarity</span>
                    <span>Matches</span>
                    <span>Viewer</span>
                  </div>
                  {currentVsHistoricalPairs.map((pair) => (
                    <div className="pair-table-row" key={pair.id}>
                      <span>{pair.leftSubmission.displayName}</span>
                      <span>{pair.rightSubmission.displayName}</span>
                      <span>{pair.similarityScore.toFixed(3)}</span>
                      <span>{pair.matchCount}</span>
                      <Link className="text-link" href={`/professor/assignments/${assignment.id}/pairs/${pair.id}`}>
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No current vs historical pairs in this run.</p>
              )}
            </>
          ) : (
            <p>No comparison results yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
