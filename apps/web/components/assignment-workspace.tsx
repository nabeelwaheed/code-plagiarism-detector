"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createComparisonRun,
  downloadAllAssignmentSubmissions,
  downloadAssignmentSubmission,
  downloadAssignmentTemplate,
  getAssignment,
  revealAssignmentSubmissionIdentity,
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
  const [revealedIdentity, setRevealedIdentity] = useState<{
    studentName: string;
    studentNumber: string;
    studentEmail: string | null;
    assignmentKey: string;
  } | null>(null);
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

  const revealIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => revealAssignmentSubmissionIdentity(assignmentId, submissionId),
    onSuccess: (identity) => {
      setRevealedIdentity(identity);
    },
  });

  const latestVisibleRun = useMemo(
    () =>
      assignmentQuery.data?.comparisonRuns.find(
        (run) => run.status === "completed" && run.pairResults.length > 0,
      ) ?? assignmentQuery.data?.comparisonRuns[0],
    [assignmentQuery.data],
  );
  const latestRun = assignmentQuery.data?.comparisonRuns[0] ?? null;

  useEffect(() => {
    setRevealedIdentity(null);
    revealIdentityMutation.reset();
  }, [selectedArtifact?.id, selectedArtifact?.type]);

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
    return (
      <p className="panel error-text">
        {assignmentQuery.error?.message ?? "That assignment no longer exists."}
      </p>
    );
  }

  const assignment = assignmentQuery.data;
  const currentSubmissions = assignment.submissions.filter((item) => item.kind === "current");
  const historicalSubmissions = assignment.submissions.filter((item) => item.kind === "historical");
  const latestUpload = trackedUploadQuery.data ?? assignment.uploadBatches[0] ?? null;
  const currentVsCurrentPairs = latestVisibleRun?.pairResults.filter(
    (pair) => pair.leftSubmission.kind === "current" && pair.rightSubmission.kind === "current",
  ) ?? [];
  const currentVsHistoricalPairs = latestVisibleRun?.pairResults.filter(
    (pair) =>
      (pair.leftSubmission.kind === "current" && pair.rightSubmission.kind === "historical")
      || (pair.leftSubmission.kind === "historical" && pair.rightSubmission.kind === "current"),
  ) ?? [];
  const visiblePairs =
    activePairCategory === "current-current" ? currentVsCurrentPairs : currentVsHistoricalPairs;
  const selectedArtifactKey = selectedArtifact ? `${selectedArtifact.type}:${selectedArtifact.id}` : null;

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Assignment workspace</p>
          <h1>{assignment.title}</h1>
          <p className="subtle-text">
            Manage uploads, browse files, and review suspicious pairs for this {" "}
            {assignment.language.toUpperCase()} assignment.
          </p>
          <div className="toolbar-row">
            <span className="status-badge is-active">{assignment.language.toUpperCase()}</span>
            <span className="pill mono">{assignment.keys[0]?.publicKey ?? "No key yet"}</span>
          </div>
        </div>

        <div className="section-stack">
          <div className="surface-muted stack-sm">
            <span className="muted-text">Comparison</span>
            <div className="meta-line">
              <span className={`status-badge ${getStatusClassName(latestRun?.status)}`}>
                {latestRun ? formatStatusLabel(latestRun.status) : "No runs yet"}
              </span>
              {latestRun ? (
                <>
                  <span className="meta-dot" />
                  <span>
                    {latestRun.pairResults.length} {latestRun.pairResults.length === 1 ? "pair" : "pairs"}
                  </span>
                </>
              ) : null}
            </div>
            <button
              className="primary-button"
              disabled={rerunMutation.isPending}
              onClick={() => rerunMutation.mutate()}
              type="button"
            >
              {rerunMutation.isPending ? "Queueing..." : "Run comparison"}
            </button>
          </div>

          {rerunMutation.error ? (
            <div className="alert alert-error">
              <p>{rerunMutation.error.message}</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="split-grid">
        <section className="panel">
          <div className="stack-sm">
            <div>
              <p className="eyebrow">Upload</p>
              <h2>Historical submissions</h2>
            </div>
            <p className="subtle-text">
              Upload one parent archive. First-layer child zip files become submissions.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleHistoricalSubmit}>
            <label className="field">
              <span>Zip archive</span>
              <input
                type="file"
                accept=".zip"
                onChange={(event) => setHistoricalFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {historicalFile ? (
              <p className="muted-text">Selected: {historicalFile.name}</p>
            ) : (
              <p className="muted-text">Choose a single zip file.</p>
            )}
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
          <div className="stack-sm">
            <div>
              <p className="eyebrow">Upload</p>
              <h2>Template code</h2>
            </div>
            <p className="subtle-text">
              Upload starter code or provided files. Template code stays separate from pair review.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleTemplateSubmit}>
            <label className="field">
              <span>Zip archive</span>
              <input
                type="file"
                accept=".zip"
                onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {templateFile ? (
              <p className="muted-text">Selected: {templateFile.name}</p>
            ) : (
              <p className="muted-text">Choose a single zip file.</p>
            )}
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

      {latestUpload ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest upload</p>
              <h2>{formatUploadPurpose(latestUpload.purpose)}</h2>
              <p className="subtle-text">
                {getUploadSummary(latestUpload.status, latestUpload.errorMessage)}
              </p>
            </div>
            <span className={`status-badge ${getStatusClassName(latestUpload.status)}`}>
              {formatStatusLabel(latestUpload.status)}
            </span>
          </div>

          {latestUpload.errorMessage ? (
            <div className="history-details">
              {shouldCollapseMessage(latestUpload.errorMessage) ? (
                <details>
                  <summary>View full message</summary>
                  <p>{latestUpload.errorMessage}</p>
                </details>
              ) : (
                <p>{latestUpload.errorMessage}</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Workspace</h2>
            <p className="subtle-text">Switch between files and suspicious pairs.</p>
          </div>
          <div className="segmented-control" role="tablist" aria-label="Workspace view">
            <button
              className={`segmented-option ${activeWorkspaceView === "submissions" ? "is-active" : ""}`}
              onClick={() => setActiveWorkspaceView("submissions")}
              type="button"
            >
              Submissions
            </button>
            <button
              className={`segmented-option ${activeWorkspaceView === "pairs" ? "is-active" : ""}`}
              onClick={() => setActiveWorkspaceView("pairs")}
              type="button"
            >
              Suspicious pairs
            </button>
          </div>
        </div>
      </section>

      {activeWorkspaceView === "submissions" ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Files</h2>
                <p className="subtle-text">
                  Current submissions, historical submissions, and template code for this assignment.
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
              <div className="alert alert-error">
                <p>{downloadMutation.error.message}</p>
              </div>
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
                <span>Template code</span>
                <strong>{assignment.activeTemplate ? 1 : 0}</strong>
              </div>
            </div>
          </section>

          <div className="split-grid">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Current</h2>
                  <p className="subtle-text">Student submissions uploaded for this assignment.</p>
                </div>
                <span className="status-badge">{currentSubmissions.length}</span>
              </div>
              {currentSubmissions.length > 0 ? (
                <div className="card-grid">
                  {currentSubmissions.map((submission) => (
                    <article
                      className={`assignment-card${selectedArtifactKey === `submission:${submission.id}` ? " is-selected" : ""}`}
                      key={submission.id}
                    >
                      <div className="stack-sm">
                        <p className="eyebrow">Current submission</p>
                        <h3>{submission.displayName}</h3>
                        <div className="meta-line">
                          <span>{submission.fileCount} files</span>
                          <span className="meta-dot" />
                          <span>{formatDateTime(submission.createdAt)}</span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          className={
                            selectedArtifactKey === `submission:${submission.id}`
                              ? "primary-button"
                              : "secondary-button"
                          }
                          onClick={() => setSelectedArtifact({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="secondary-button"
                          disabled={downloadMutation.isPending}
                          onClick={() =>
                            downloadMutation.mutate({ type: "submission", id: submission.id })
                          }
                          type="button"
                        >
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No current submissions yet.</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Historical</h2>
                  <p className="subtle-text">Past submissions used for current-to-historical review.</p>
                </div>
                <span className="status-badge">{historicalSubmissions.length}</span>
              </div>
              {historicalSubmissions.length > 0 ? (
                <div className="card-grid">
                  {historicalSubmissions.map((submission) => (
                    <article
                      className={`assignment-card${selectedArtifactKey === `submission:${submission.id}` ? " is-selected" : ""}`}
                      key={submission.id}
                    >
                      <div className="stack-sm">
                        <p className="eyebrow">Historical submission</p>
                        <h3>{submission.displayName}</h3>
                        <div className="meta-line">
                          <span>{submission.fileCount} files</span>
                          <span className="meta-dot" />
                          <span>{formatDateTime(submission.createdAt)}</span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          className={
                            selectedArtifactKey === `submission:${submission.id}`
                              ? "primary-button"
                              : "secondary-button"
                          }
                          onClick={() => setSelectedArtifact({ type: "submission", id: submission.id })}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="secondary-button"
                          disabled={downloadMutation.isPending}
                          onClick={() =>
                            downloadMutation.mutate({ type: "submission", id: submission.id })
                          }
                          type="button"
                        >
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No historical submissions yet.</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Template</h2>
                  <p className="subtle-text">Starter code and provided files kept out of pair scoring.</p>
                </div>
                <span className={`status-badge ${assignment.activeTemplate ? "is-active" : ""}`}>
                  {assignment.activeTemplate ? "Active" : "Missing"}
                </span>
              </div>
              {assignment.activeTemplate ? (
                <div className="card-grid">
                  <article
                    className={`assignment-card${selectedArtifactKey === `template:${assignment.activeTemplate.id}` ? " is-selected" : ""}`}
                  >
                    <div className="stack-sm">
                      <p className="eyebrow">Template code</p>
                      <h3>Version {assignment.activeTemplate.versionNumber}</h3>
                      <div className="meta-line">
                        <span>{assignment.activeTemplate.fileCount} files</span>
                        <span className="meta-dot" />
                        <span>{formatDateTime(assignment.activeTemplate.createdAt)}</span>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        className={
                          selectedArtifactKey === `template:${assignment.activeTemplate.id}`
                            ? "primary-button"
                            : "secondary-button"
                        }
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
                <div className="empty-state">
                  <p>No template code uploaded yet.</p>
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Viewer</h2>
                <p className="subtle-text">Open a submission or template to inspect files and source content.</p>
              </div>
              {artifactDetailQuery.data ? (
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
              ) : null}
            </div>
            {!selectedArtifact ? (
              <div className="empty-state viewer-empty">
                <p>Select a submission or template to open it here.</p>
              </div>
            ) : artifactDetailQuery.isLoading ? (
              <div className="empty-state viewer-empty">
                <p>Loading viewer...</p>
              </div>
            ) : artifactDetailQuery.error ? (
              <div className="alert alert-error">
                <p>{artifactDetailQuery.error.message}</p>
              </div>
            ) : artifactDetailQuery.data ? (
              <div className="file-viewer">
                <div className="artifact-header">
                  <div className="stack-sm">
                    <div>
                      <p className="eyebrow">
                        {artifactDetailQuery.data.kind === "template"
                          ? `Template code v${artifactDetailQuery.data.versionNumber ?? 1}`
                          : `${capitalizeLabel(artifactDetailQuery.data.kind)} submission`}
                      </p>
                      <h3>{artifactDetailQuery.data.displayName}</h3>
                    </div>
                    <div className="meta-line">
                      <span>{artifactDetailQuery.data.fileCount} files</span>
                      <span className="meta-dot" />
                      <span>{formatDateTime(artifactDetailQuery.data.createdAt)}</span>
                    </div>
                    {artifactDetailQuery.data.kind !== "template" && artifactDetailQuery.data.hasEncryptedIdentity ? (
                      <div className="stack-sm">
                        <div className="toolbar-row">
                          <button
                            className="secondary-button"
                            disabled={revealIdentityMutation.isPending}
                            onClick={() => revealIdentityMutation.mutate(artifactDetailQuery.data!.id)}
                            type="button"
                          >
                            {revealIdentityMutation.isPending ? "Revealing..." : "Reveal identity"}
                          </button>
                        </div>
                        {revealIdentityMutation.error ? (
                          <p className="error-text">{revealIdentityMutation.error.message}</p>
                        ) : null}
                        {revealedIdentity ? (
                          <div className="surface-muted stack-sm">
                            <strong>Revealed identity</strong>
                            <p>Name: {revealedIdentity.studentName}</p>
                            <p>Student number: {revealedIdentity.studentNumber}</p>
                            <p>Email: {revealedIdentity.studentEmail ?? "Not provided"}</p>
                            <p>Assignment keyID: {revealedIdentity.assignmentKey}</p>
                          </div>
                        ) : (
                          <p className="muted-text">
                            This submission stores an encrypted identity that can be revealed only in
                            the professor workflow.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <span className={`status-badge ${artifactDetailQuery.data.kind === "template" ? "is-active" : ""}`}>
                    {artifactDetailQuery.data.kind === "template"
                      ? "Template"
                      : capitalizeLabel(artifactDetailQuery.data.kind)}
                  </span>
                </div>

                <div className="artifact-files">
                  {artifactDetailQuery.data.files.map((file) => {
                    const isJunk = isLikelyJunkFile(file.relativePath, file.archivePath);

                    return (
                      <article
                        className={`artifact-file-card${isJunk ? " is-junk" : ""}`}
                        key={file.id}
                      >
                        <div className="artifact-file-head">
                          <div>
                            <span className="artifact-subpath">{file.archivePath ?? "Source file"}</span>
                            <span className="artifact-file-path mono">{file.relativePath}</span>
                          </div>
                          <span className={`status-badge ${isJunk ? "" : "is-active"}`}>
                            {isJunk ? "System file" : "Source"}
                          </span>
                        </div>

                        <div className="code-surface">
                          <div className="code-surface-head">
                            <span className="mono">{file.relativePath}</span>
                            <div className="dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                          <pre>{file.contents}</pre>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-state viewer-empty">
                <p>Select a submission or template to open it here.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Recent uploads</h2>
                <p className="subtle-text">Recent upload batches and status updates for this assignment.</p>
              </div>
            </div>
            {assignment.uploadBatches.length > 0 ? (
              <div className="history-list">
                {assignment.uploadBatches.map((batch) => {
                  const message = batch.errorMessage?.trim() ?? "";

                  return (
                    <article className="history-item" key={batch.id}>
                      <div className="history-top">
                        <div>
                          <strong>{formatUploadPurpose(batch.purpose)}</strong>
                          <div className="meta-line">
                            <span>{formatDateTime(batch.createdAt)}</span>
                            <span className="meta-dot" />
                            <span>Updated {formatDateTime(batch.updatedAt)}</span>
                          </div>
                        </div>
                        <span className={`status-badge ${getStatusClassName(batch.status)}`}>
                          {formatStatusLabel(batch.status)}
                        </span>
                      </div>
                      <p className="history-message">{getUploadSummary(batch.status, batch.errorMessage)}</p>
                      {message ? (
                        <div className="history-details">
                          {shouldCollapseMessage(message) ? (
                            <details>
                              <summary>View full message</summary>
                              <p>{message}</p>
                            </details>
                          ) : (
                            <p>{message}</p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>No uploads yet.</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Suspicious pairs</h2>
              <p className="subtle-text">Review the latest eligible comparison results for this assignment.</p>
            </div>
            <div className="segmented-control" role="tablist" aria-label="Pair category">
              <button
                className={`segmented-option ${activePairCategory === "current-current" ? "is-active" : ""}`}
                onClick={() => setActivePairCategory("current-current")}
                type="button"
              >
                Current vs current
              </button>
              <button
                className={`segmented-option ${activePairCategory === "current-historical" ? "is-active" : ""}`}
                onClick={() => setActivePairCategory("current-historical")}
                type="button"
              >
                Current vs historical
              </button>
            </div>
          </div>

          {latestVisibleRun ? (
            <div className="section-stack">
              <div className="surface-muted stack-sm">
                <div className="meta-line">
                  <span className={`status-badge ${getStatusClassName(latestVisibleRun.status)}`}>
                    {formatStatusLabel(latestVisibleRun.status)}
                  </span>
                  <span className="meta-dot" />
                  <span>Latest run: {latestVisibleRun.id}</span>
                  <span className="meta-dot" />
                  <span>
                    {visiblePairs.length} {visiblePairs.length === 1 ? "pair" : "pairs"} in this view
                  </span>
                </div>
                {latestVisibleRun.errorMessage ? (
                  <div className="history-details">
                    {shouldCollapseMessage(latestVisibleRun.errorMessage) ? (
                      <details>
                        <summary>View full message</summary>
                        <p>{latestVisibleRun.errorMessage}</p>
                      </details>
                    ) : (
                      <p>{latestVisibleRun.errorMessage}</p>
                    )}
                  </div>
                ) : null}
              </div>

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
                      <div className="stack-sm">
                        <strong>{pair.leftSubmission.displayName}</strong>
                        <span className="pair-note">{capitalizeLabel(pair.leftSubmission.kind)}</span>
                      </div>
                      <div className="stack-sm">
                        <strong>{pair.rightSubmission.displayName}</strong>
                        <span className="pair-note">{capitalizeLabel(pair.rightSubmission.kind)}</span>
                      </div>
                      <span className="pair-value">{pair.similarityScore.toFixed(3)}</span>
                      <span className="pair-value">{pair.matchCount}</span>
                      <Link
                        className="secondary-button as-link"
                        href={`/professor/assignments/${assignment.id}/pairs/${pair.id}`}
                      >
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>
                    {activePairCategory === "current-current"
                      ? "No current vs current pairs in this run."
                      : "No current vs historical pairs in this run."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No results yet.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatUploadPurpose(purpose: string) {
  if (purpose === "historical_submission") {
    return "Historical submissions";
  }

  if (purpose === "template_upload") {
    return "Template code";
  }

  return capitalizeLabel(purpose.replace(/[_-]+/g, " "));
}

function formatStatusLabel(status: string) {
  return capitalizeLabel(status.replace(/[_-]+/g, " "));
}

function getStatusClassName(status?: string | null) {
  const normalized = status?.toLowerCase() ?? "";

  if (!normalized) {
    return "";
  }

  if (normalized.includes("ready") || normalized.includes("completed") || normalized.includes("active")) {
    return "is-ready";
  }

  if (normalized.includes("failed")) {
    return "is-failed";
  }

  if (normalized.includes("running") || normalized.includes("processing")) {
    return "is-running";
  }

  if (normalized.includes("queued")) {
    return "is-queued";
  }

  return "";
}

function getUploadSummary(status: string, errorMessage: string | null) {
  if (errorMessage) {
    return summarizeMessage(errorMessage, "There was a problem with this upload.");
  }

  const normalized = status.toLowerCase();

  if (normalized === "ready" || normalized === "completed") {
    return "This upload finished successfully.";
  }

  if (normalized === "failed") {
    return "This upload did not finish successfully.";
  }

  if (normalized === "queued") {
    return "This upload is waiting to be processed.";
  }

  if (normalized === "processing" || normalized === "running") {
    return "This upload is still being processed.";
  }

  return "Status updated.";
}

function summarizeMessage(message: string, fallback: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!shouldCollapseMessage(trimmed)) {
    return trimmed;
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine && firstLine.length <= 120 && !looksTechnical(firstLine)) {
    return firstLine;
  }

  return fallback;
}

function shouldCollapseMessage(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 120 || /[\r\n]/.test(trimmed) || looksTechnical(trimmed);
}

function looksTechnical(message: string) {
  return /(exception|traceback|stack|invalid byte sequence|prisma|postgres|errno| at |\\|\/|0x[0-9a-f]+)/i.test(
    message,
  );
}

function isLikelyJunkFile(relativePath: string, archivePath?: string) {
  const candidate = `${relativePath} ${archivePath ?? ""}`;
  return /(^|[\\/])__macosx([\\/]|$)|(^|[\\/])\._|(^|[\\/])\.ds_store$|thumbs\.db$/i.test(candidate);
}

function capitalizeLabel(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
