"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  createComparisonRun,
  downloadAllAssignmentSubmissions,
  downloadAssignmentSubmission,
  downloadAssignmentTemplate,
  getAssignment,
  getAssignmentSubmissionDetail,
  getAssignmentTemplateDetail,
  getUploadBatch,
  uploadProfessorArchive,
} from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

type SelectedArtifact =
  | { type: "submission"; id: string }
  | { type: "template"; id: string }
  | null;

export function AssignmentWorkspace({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [trackedUploadBatchId, setTrackedUploadBatchId] = useState<string | null>(null);
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<"submissions" | "pairs">(
    "submissions",
  );
  const [activePairCategory, setActivePairCategory] = useState<
    "current-current" | "current-historical"
  >("current-current");
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact>(null);
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

  const artifactDetailQuery = useQuery({
    queryKey: ["assignment-artifact", assignmentId, selectedArtifact?.type, selectedArtifact?.id],
    queryFn: () => {
      if (!selectedArtifact) {
        throw new Error("No artifact selected");
      }

      return selectedArtifact.type === "template"
        ? getAssignmentTemplateDetail(assignmentId, selectedArtifact.id)
        : getAssignmentSubmissionDetail(assignmentId, selectedArtifact.id);
    },
    enabled: activeWorkspaceView === "submissions" && Boolean(selectedArtifact),
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

  const downloadMutation = useMutation({
    mutationFn: async (
      input:
        | { type: "all" }
        | { type: "submission"; id: string }
        | { type: "template"; id: string },
    ) => {
      if (input.type === "all") {
        await downloadAllAssignmentSubmissions(assignmentId);
        return;
      }

      if (input.type === "template") {
        await downloadAssignmentTemplate(assignmentId, input.id);
        return;
      }

      await downloadAssignmentSubmission(assignmentId, input.id);
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
  const visiblePairs =
    activePairCategory === "current-current" ? currentVsCurrentPairs : currentVsHistoricalPairs;

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
            <div className="section-heading">
              <div>
                <h2>Prepared artifacts</h2>
                <p>
                  Browse current submissions, historical submissions, and the active template for
                  this assignment.
                </p>
              </div>
              <button
                className="secondary-button"
                disabled={downloadMutation.isPending || assignment.submissions.length === 0}
                onClick={() => downloadMutation.mutate({ type: "all" })}
                type="button"
              >
                {downloadMutation.isPending ? "Preparing..." : "Download all submissions"}
              </button>
            </div>
            {downloadMutation.error ? (
              <p className="error-text">{downloadMutation.error.message}</p>
            ) : null}
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

          <div className="split-grid">
            <section className="panel">
              <h2>Current</h2>
              {currentSubmissions.length > 0 ? (
                <div className="card-grid">
                  {currentSubmissions.map((submission) => (
                    <article className="assignment-card" key={submission.id}>
                      <div>
                        <p className="eyebrow">{submission.fileCount} files</p>
                        <h3>{submission.displayName}</h3>
                        <p>Created {new Date(submission.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="hero-meta">
                        <button
                          className="secondary-button"
                          onClick={() => setSelectedArtifact({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="secondary-button"
                          disabled={downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No current submissions yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>Historical</h2>
              {historicalSubmissions.length > 0 ? (
                <div className="card-grid">
                  {historicalSubmissions.map((submission) => (
                    <article className="assignment-card" key={submission.id}>
                      <div>
                        <p className="eyebrow">{submission.fileCount} files</p>
                        <h3>{submission.displayName}</h3>
                        <p>Created {new Date(submission.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="hero-meta">
                        <button
                          className="secondary-button"
                          onClick={() => setSelectedArtifact({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="secondary-button"
                          disabled={downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No historical submissions yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>Template</h2>
              {assignment.activeTemplate ? (
                <div className="card-grid">
                  <article className="assignment-card">
                    <div>
                      <p className="eyebrow">Version {assignment.activeTemplate.versionNumber}</p>
                      <h3>Active template</h3>
                      <p>
                        {assignment.activeTemplate.fileCount} files · created{" "}
                        {new Date(assignment.activeTemplate.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="hero-meta">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setSelectedArtifact({
                            type: "template",
                            id: assignment.activeTemplate!.id,
                          })
                        }
                        type="button"
                      >
                        View
                      </button>
                      <button
                        className="secondary-button"
                        disabled={downloadMutation.isPending}
                        onClick={() =>
                          downloadMutation.mutate({
                            type: "template",
                            id: assignment.activeTemplate!.id,
                          })
                        }
                        type="button"
                      >
                        Download
                      </button>
                    </div>
                  </article>
                </div>
              ) : (
                <p>No active template uploaded yet.</p>
              )}
            </section>
          </div>

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

          <section className="panel">
            <h2>Selected artifact</h2>
            {!selectedArtifact ? (
              <p>Select a submission or template to view its contents.</p>
            ) : artifactDetailQuery.isLoading ? (
              <p>Loading artifact...</p>
            ) : artifactDetailQuery.error ? (
              <p className="error-text">{artifactDetailQuery.error.message}</p>
            ) : artifactDetailQuery.data ? (
              <div className="page-stack">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {artifactDetailQuery.data.kind === "template"
                        ? `Template v${artifactDetailQuery.data.versionNumber ?? 1}`
                        : `${artifactDetailQuery.data.kind} submission`}
                    </p>
                    <h3>{artifactDetailQuery.data.displayName}</h3>
                    <p>
                      {artifactDetailQuery.data.fileCount} files · created{" "}
                      {new Date(artifactDetailQuery.data.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={downloadMutation.isPending}
                    onClick={() =>
                      artifactDetailQuery.data.kind === "template"
                        ? downloadMutation.mutate({
                            type: "template",
                            id: artifactDetailQuery.data.id,
                          })
                        : downloadMutation.mutate({
                            type: "submission",
                            id: artifactDetailQuery.data.id,
                          })
                    }
                    type="button"
                  >
                    Download
                  </button>
                </div>

                {artifactDetailQuery.data.files.map((file) => (
                  <article className="assignment-card" key={file.id}>
                    <div>
                      <p className="eyebrow">{file.archivePath ?? "prepared source file"}</p>
                      <h3>{file.relativePath}</h3>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                        background: "#fffdf7",
                        border: "1px solid rgba(217, 210, 192, 0.6)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                      }}
                    >
                      {file.contents}
                    </pre>
                  </article>
                ))}
              </div>
            ) : (
              <p>Select a submission or template to view its contents.</p>
            )}
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

              <div className="hero-meta">
                <button
                  className={activePairCategory === "current-current" ? "primary-button" : "secondary-button"}
                  onClick={() => setActivePairCategory("current-current")}
                  type="button"
                >
                  Current vs current
                </button>
                <button
                  className={activePairCategory === "current-historical" ? "primary-button" : "secondary-button"}
                  onClick={() => setActivePairCategory("current-historical")}
                  type="button"
                >
                  Current vs historical
                </button>
              </div>

              <h3>
                {activePairCategory === "current-current"
                  ? "Current vs current"
                  : "Current vs historical"}
              </h3>
              {visiblePairs.length > 0 ? (
                <div className="pair-table">
                  <div className="pair-table-head">
                    <span>Left</span>
                    <span>Right</span>
                    <span>Similarity</span>
                    <span>Matches</span>
                    <span>Viewer</span>
                  </div>
                  {visiblePairs.map((pair) => (
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
                <p>
                  {activePairCategory === "current-current"
                    ? "No current vs current pairs in this run."
                    : "No current vs historical pairs in this run."}
                </p>
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
