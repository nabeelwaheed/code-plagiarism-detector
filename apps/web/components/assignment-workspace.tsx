"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createComparisonRun,
  deleteAssignment,
  deleteAssignmentCategory,
  deleteAssignmentSubmission,
  deleteAssignmentTemplate,
  downloadAllAssignmentSubmissions,
  downloadAssignmentSubmission,
  downloadAssignmentTemplate,
  getAssignment,
  revealAssignmentSubmissionIdentity,
  getAssignmentSubmissionDetail,
  getAssignmentTemplateDetail,
  getUploadBatch,
  updateAssignmentDueDate,
  uploadProfessorArchive,
  type SubmissionIdentityRevealResponse,
} from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { SubmissionIdentityPanel } from "./submission-identity-panel";

type SelectedArtifact =
  | { type: "submission"; id: string }
  | { type: "template"; id: string }
  | null;

const CODE_SUSPICIOUS_THRESHOLD = 0.35;

export function AssignmentWorkspace({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
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
  const [showAllPairs, setShowAllPairs] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact>(null);
  const [revealedIdentity, setRevealedIdentity] = useState<SubmissionIdentityRevealResponse | null>(null);
  const [dangerFeedback, setDangerFeedback] = useState<string | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDateFeedback, setDueDateFeedback] = useState<string | null>(null);
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
  const deleteAssignmentMutation = useMutation({
    mutationFn: () => deleteAssignment(assignmentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
      router.push("/professor?message=assignment-deleted");
    },
  });
  const deleteSubmissionMutation = useMutation({
    mutationFn: (submissionId: string) => deleteAssignmentSubmission(assignmentId, submissionId),
    onSuccess: async () => {
      setDangerFeedback("Historical submission deleted. Comparison results were cleared.");
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      revealIdentityMutation.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteAssignmentTemplate(assignmentId, templateId),
    onSuccess: async () => {
      setDangerFeedback("Template deleted. Comparison results were cleared.");
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      revealIdentityMutation.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (category: "current" | "historical" | "template") =>
      deleteAssignmentCategory(assignmentId, category),
    onSuccess: async (result, category) => {
      setDangerFeedback(
        result.deletedCount > 0
          ? `Deleted ${result.deletedCount} ${category === "template" ? "template item" : category + " submission"}${result.deletedCount === 1 ? "" : "s"}. Comparison results were cleared.`
          : `There were no ${category} items to delete.`,
      );
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      revealIdentityMutation.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
  });
  const updateDueDateMutation = useMutation({
    mutationFn: (nextDueDate: string | null) => updateAssignmentDueDate(assignmentId, nextDueDate),
    onSuccess: async (result) => {
      setDueDateFeedback(result.dueDate ? "Due date updated." : "Due date cleared.");
      setIsEditingDueDate(false);
      setDueDateInput(toDateTimeLocalInputValue(result.dueDate));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
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

  useEffect(() => {
    setDueDateInput(toDateTimeLocalInputValue(assignmentQuery.data?.dueDate ?? null));
  }, [assignmentQuery.data?.dueDate]);

  const handleHideIdentity = () => {
    setRevealedIdentity(null);
    revealIdentityMutation.reset();
  };

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
  const templateVersions = assignment.templateVersions;
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
  const sectionedPairs = partitionSuspiciousPairs(visiblePairs);
  const selectedArtifactKey = selectedArtifact ? `${selectedArtifact.type}:${selectedArtifact.id}` : null;
  const hasActiveAssignmentJobs =
    assignment.uploadBatches.some(
      (batch) => batch.status === "received" || batch.status === "processing",
    )
    || assignment.comparisonRuns.some(
      (run) => run.status === "queued" || run.status === "running",
    );
  const isDangerActionPending =
    deleteAssignmentMutation.isPending
    || deleteSubmissionMutation.isPending
    || deleteTemplateMutation.isPending
    || deleteCategoryMutation.isPending;
  const destructiveError =
    deleteAssignmentMutation.error?.message
    ?? deleteSubmissionMutation.error?.message
    ?? deleteTemplateMutation.error?.message
    ?? deleteCategoryMutation.error?.message
    ?? null;

  const handleDeleteAssignment = () => {
    setDangerFeedback(null);

    const confirmation = window.prompt(
      `Type DELETE to permanently remove "${assignment.title}" and all of its assignment data.`,
      "",
    );

    if (confirmation !== "DELETE") {
      return;
    }

    deleteAssignmentMutation.mutate();
  };

  const handleDeleteHistoricalSubmission = (submissionId: string, displayName: string) => {
    setDangerFeedback(null);

    const confirmed = window.confirm(
      `Delete the historical submission "${displayName}"? This will also clear comparison results for this assignment.`,
    );

    if (!confirmed) {
      return;
    }

    deleteSubmissionMutation.mutate(submissionId);
  };

  const handleDeleteTemplate = (templateId: string, versionNumber: number) => {
    setDangerFeedback(null);

    const confirmed = window.confirm(
      `Delete template version ${versionNumber}? This will also clear comparison results for this assignment.`,
    );

    if (!confirmed) {
      return;
    }

    deleteTemplateMutation.mutate(templateId);
  };

  const handleDeleteCategory = (
    category: "current" | "historical" | "template",
    count: number,
  ) => {
    setDangerFeedback(null);

    const label = category === "template" ? "template item" : `${category} submission`;
    const confirmed = window.confirm(
      `Delete all ${count} ${label}${count === 1 ? "" : "s"} in this assignment? This will also clear comparison results for this assignment.`,
    );

    if (!confirmed) {
      return;
    }

    deleteCategoryMutation.mutate(category);
  };

  const handleDueDateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDueDateFeedback(null);

    const nextDueDate = dueDateInput.trim() ? new Date(dueDateInput) : null;
    if (nextDueDate && Number.isNaN(nextDueDate.getTime())) {
      setDueDateFeedback("Please provide a valid due date.");
      return;
    }

    updateDueDateMutation.mutate(nextDueDate ? nextDueDate.toISOString() : null);
  };

  const handleClearDueDate = () => {
    setDueDateFeedback(null);
    updateDueDateMutation.mutate(null);
  };

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Assignment workspace</p>
          <h1>{assignment.title}</h1>
          <p className="subtle-text">
            Review uploads, files, and suspicious pairs for this {assignment.language.toUpperCase()} assignment.
          </p>
          <div className="toolbar-row">
            <span className="status-badge is-active">{assignment.language.toUpperCase()}</span>
            <span className="pill mono">{assignment.keys[0]?.publicKey ?? "No key yet"}</span>
          </div>
        </div>

        <div className="section-stack">
          <div className="toolbar-row">
            <Link className="secondary-button as-link" href="/professor">
              Back to professor home
            </Link>
          </div>
          <div className="surface-muted stack-sm">
            <span className="muted-text">Due date</span>
            <p>{assignment.dueDate ? formatDateTime(assignment.dueDate) : "No due date set"}</p>
            <p className="pair-note">Shown in your local time. This pass does not enforce deadlines.</p>
            {dueDateFeedback ? (
              <div className="alert alert-info">
                <p>{dueDateFeedback}</p>
              </div>
            ) : null}
            {updateDueDateMutation.error ? (
              <div className="alert alert-error">
                <p>{updateDueDateMutation.error.message}</p>
              </div>
            ) : null}
            {isEditingDueDate ? (
              <form className="form-stack form-compact" onSubmit={handleDueDateSubmit}>
                <label className="field">
                  <span>Due date</span>
                  <input
                    type="datetime-local"
                    value={dueDateInput}
                    onChange={(event) => setDueDateInput(event.target.value)}
                  />
                </label>
                <div className="toolbar-row">
                  <button
                    className="primary-button"
                    disabled={updateDueDateMutation.isPending}
                    type="submit"
                  >
                    {updateDueDateMutation.isPending ? "Saving..." : "Save due date"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={updateDueDateMutation.isPending}
                    type="button"
                    onClick={() => {
                      setIsEditingDueDate(false);
                      setDueDateInput(toDateTimeLocalInputValue(assignment.dueDate));
                      setDueDateFeedback(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="secondary-button"
                    disabled={updateDueDateMutation.isPending || !assignment.dueDate}
                    type="button"
                    onClick={handleClearDueDate}
                  >
                    Clear
                  </button>
                </div>
              </form>
            ) : (
              <div className="toolbar-row">
                <button
                  className="secondary-button"
                  disabled={updateDueDateMutation.isPending}
                  type="button"
                  onClick={() => {
                    setDueDateFeedback(null);
                    setIsEditingDueDate(true);
                  }}
                >
                  {assignment.dueDate ? "Edit due date" : "Set due date"}
                </button>
                {assignment.dueDate ? (
                  <button
                    className="secondary-button"
                    disabled={updateDueDateMutation.isPending}
                    type="button"
                    onClick={handleClearDueDate}
                  >
                    Clear due date
                  </button>
                ) : null}
              </div>
            )}
          </div>
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

          <div className="workspace-controls">
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
            {activeWorkspaceView === "pairs" ? (
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
            ) : null}
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

          <form className="form-stack form-compact" onSubmit={handleHistoricalSubmit}>
            <label className="field">
              <span>Zip archive</span>
              <input
                type="file"
                accept=".zip"
                onChange={(event) => setHistoricalFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {historicalFile ? <p className="muted-text">Selected: {historicalFile.name}</p> : null}
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

          <form className="form-stack form-compact" onSubmit={handleTemplateSubmit}>
            <label className="field">
              <span>Zip archive</span>
              <input
                type="file"
                accept=".zip"
                onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {templateFile ? <p className="muted-text">Selected: {templateFile.name}</p> : null}
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
            </div>
            <span className={`status-badge ${getStatusClassName(latestUpload.status)}`}>
              {formatStatusLabel(latestUpload.status)}
            </span>
          </div>

          <p className="subtle-text">
            {getUploadSummary(latestUpload.status, latestUpload.errorMessage)}
          </p>

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

      {activeWorkspaceView === "submissions" ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>Files</h2>
              <button
                className="secondary-button"
                disabled={downloadMutation.isPending || currentSubmissions.length === 0}
                onClick={() => downloadMutation.mutate({ type: "all" })}
                type="button"
              >
                {downloadMutation.isPending ? "Preparing..." : "Download current submissions"}
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
                <span>Template versions</span>
                <strong>{templateVersions.length}</strong>
              </div>
            </div>
          </section>

          <div className="split-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>Current</h2>
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
                          disabled={isDangerActionPending || hasActiveAssignmentJobs}
                          onClick={() =>
                            handleDeleteHistoricalSubmission(submission.id, submission.displayName)
                          }
                          type="button"
                        >
                          Delete
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
                <h2>Historical</h2>
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
                <h2>Template versions</h2>
                <span className={`status-badge ${templateVersions.length > 0 ? "is-active" : ""}`}>
                  {templateVersions.length > 0 ? templateVersions.length : "Missing"}
                </span>
              </div>
              {templateVersions.length > 0 ? (
                <div className="card-grid">
                  {templateVersions.map((template) => (
                    <article
                      className={`assignment-card${selectedArtifactKey === `template:${template.id}` ? " is-selected" : ""}`}
                      key={template.id}
                    >
                      <div className="stack-sm">
                        <p className="eyebrow">Template code</p>
                        <h3>Version {template.versionNumber}</h3>
                        <div className="meta-line">
                          <span>{template.fileCount} files</span>
                          <span className="meta-dot" />
                          <span>{formatDateTime(template.createdAt)}</span>
                        </div>
                        <div className="meta-line">
                          <span className={`status-badge ${template.isActive ? "is-active" : ""}`}>
                            {template.isActive ? "Active template" : "Inactive template"}
                          </span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          className={
                            selectedArtifactKey === `template:${template.id}`
                              ? "primary-button"
                              : "secondary-button"
                          }
                          onClick={() =>
                            setSelectedArtifact({
                              type: "template",
                              id: template.id,
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
                              id: template.id,
                            })
                          }
                          type="button"
                        >
                          Download
                        </button>
                        <button
                          className="secondary-button"
                          disabled={isDangerActionPending || hasActiveAssignmentJobs}
                          onClick={() => handleDeleteTemplate(template.id, template.versionNumber)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No template versions uploaded yet.</p>
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="section-heading">
              <h2>Viewer</h2>
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
                    {artifactDetailQuery.data.kind !== "template" ? (
                      <SubmissionIdentityPanel
                        identityRevealMode={artifactDetailQuery.data.identityRevealMode}
                        isRevealPending={revealIdentityMutation.isPending}
                        onHide={handleHideIdentity}
                        onReveal={
                          artifactDetailQuery.data.identityRevealMode
                            ? () => revealIdentityMutation.mutate(artifactDetailQuery.data!.id)
                            : null
                        }
                        revealError={revealIdentityMutation.error?.message ?? null}
                        revealedIdentity={revealedIdentity}
                      />
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
              <h2>Recent uploads</h2>
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
            <h2>Suspicious pairs</h2>
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
                  <span>{sectionedPairs.shownCount} shown of {sectionedPairs.totalCount} pairs</span>
                </div>
                {sectionedPairs.hiddenPairs.length > 0 ? (
                  <div className="toolbar-row">
                    <button
                      className="secondary-button"
                      onClick={() => setShowAllPairs((current) => !current)}
                      type="button"
                    >
                      {showAllPairs ? "Hide lower-priority pairs" : "Show all pairs"}
                    </button>
                  </div>
                ) : null}
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
                <div className="section-stack">
                  {sectionedPairs.codeSuspicious.length > 0 ? (
                    <PairSection
                      assignmentId={assignment.id}
                      description={`Code similarity at or above ${formatSimilarityPercent(CODE_SUSPICIOUS_THRESHOLD)}.`}
                      pairs={sectionedPairs.codeSuspicious}
                      title="Suspicious by code"
                    />
                  ) : null}

                  {sectionedPairs.commentSupportedLowCode.length > 0 ? (
                    <PairSection
                      assignmentId={assignment.id}
                      description="Visible by default because they have one or more meaningful comment matches, but they stay below the main code-suspicious pairs."
                      pairs={sectionedPairs.commentSupportedLowCode}
                      title="Comment-supported low-code pairs"
                    />
                  ) : null}

                  {showAllPairs && sectionedPairs.hiddenPairs.length > 0 ? (
                    <PairSection
                      assignmentId={assignment.id}
                      description="Remaining pairs shown for completeness. These stay below the main suspicious sections."
                      pairs={sectionedPairs.hiddenPairs}
                      title="Remaining pairs"
                    />
                  ) : null}
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

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Danger zone</p>
            <h2>Delete assignment data</h2>
          </div>
          <span className="status-badge is-failed">Destructive</span>
        </div>

        <div className="section-stack">
          <p className="subtle-text">
            These actions permanently remove assignment data. Any delete that changes the comparison
            pool also clears comparison results for this assignment.
          </p>

          {hasActiveAssignmentJobs ? (
            <div className="alert alert-info">
              <p>Deletes are disabled while uploads or comparison runs are still in progress.</p>
            </div>
          ) : null}

          {dangerFeedback ? (
            <div className="alert alert-info">
              <p>{dangerFeedback}</p>
            </div>
          ) : null}

          {destructiveError ? (
            <div className="alert alert-error">
              <p>{destructiveError}</p>
            </div>
          ) : null}

          <div className="surface-muted stack-sm">
            <strong>Delete all items in one category</strong>
            <div className="toolbar-row">
              <button
                className="secondary-button"
                disabled={isDangerActionPending || hasActiveAssignmentJobs || currentSubmissions.length === 0}
                onClick={() => handleDeleteCategory("current", currentSubmissions.length)}
                type="button"
              >
                Delete all current ({currentSubmissions.length})
              </button>
              <button
                className="secondary-button"
                disabled={isDangerActionPending || hasActiveAssignmentJobs || historicalSubmissions.length === 0}
                onClick={() => handleDeleteCategory("historical", historicalSubmissions.length)}
                type="button"
              >
                Delete all historical ({historicalSubmissions.length})
              </button>
              <button
                className="secondary-button"
                disabled={isDangerActionPending || hasActiveAssignmentJobs || templateVersions.length === 0}
                onClick={() => handleDeleteCategory("template", templateVersions.length)}
                type="button"
              >
                Delete all template ({templateVersions.length})
              </button>
            </div>
          </div>

          <div className="surface-muted stack-sm">
            <strong>Delete entire assignment</strong>
            <p className="pair-note">
              Type <span className="mono">DELETE</span> when prompted to remove this assignment and all
              related uploads, artifacts, and comparison data.
            </p>
            <div className="toolbar-row">
              <button
                className="secondary-button"
                disabled={isDangerActionPending || hasActiveAssignmentJobs}
                onClick={handleDeleteAssignment}
                type="button"
              >
                {deleteAssignmentMutation.isPending ? "Deleting..." : "Delete assignment"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toDateTimeLocalInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function formatSimilarityPercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function PairSection({
  assignmentId,
  description,
  pairs,
  title,
}: {
  assignmentId: string;
  description: string;
  pairs: SuspiciousPairListItem[];
  title: string;
}) {
  return (
    <section className="surface-muted stack-sm">
      <div className="stack-sm">
        <div className="section-heading">
          <h3>{title}</h3>
          <span className="status-badge">{pairs.length}</span>
        </div>
        <p className="pair-note">{description}</p>
      </div>

      <div className="pair-table">
        <div className="pair-table-head">
          <span>Left</span>
          <span>Right</span>
          <span>Scores</span>
          <span>Matches</span>
          <span>Viewer</span>
        </div>
        {pairs.map((pair) => (
          <div className="pair-table-row" key={pair.id}>
            <div className="stack-sm">
              <strong>{pair.leftSubmission.displayName}</strong>
              <span className="pair-note">{capitalizeLabel(pair.leftSubmission.kind)}</span>
            </div>
            <div className="stack-sm">
              <strong>{pair.rightSubmission.displayName}</strong>
              <span className="pair-note">{capitalizeLabel(pair.rightSubmission.kind)}</span>
            </div>
            <div className="pair-score-stack">
              <span className="pair-score-line">
                <strong>Code</strong> {formatSimilarityPercent(pair.similarityScore)}
              </span>
              <span className="pair-score-line">
                <strong>Comment matches</strong> {pair.commentMatchCount}
              </span>
            </div>
            <span className="pair-value">{pair.matchCount}</span>
            <Link
              className="secondary-button as-link"
              href={`/professor/assignments/${assignmentId}/pairs/${pair.id}`}
            >
              Open
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

type SuspiciousPairListItem = {
  id: string;
  similarityScore: number;
  commentMatchCount: number;
  matchedTokenCount: number;
  matchCount: number;
  leftSubmission: {
    id: string;
    displayName: string;
    kind: "current" | "historical";
  };
  rightSubmission: {
    id: string;
    displayName: string;
    kind: "current" | "historical";
  };
};

function partitionSuspiciousPairs(pairs: SuspiciousPairListItem[]) {
  const indexedPairs = pairs.map((pair, index) => ({ pair, index }));
  const codeSuspicious = indexedPairs
    .filter(({ pair }) => pair.similarityScore >= CODE_SUSPICIOUS_THRESHOLD)
    .sort((left, right) =>
      compareSuspiciousPairs(
        left,
        right,
        [
          (pair) => pair.similarityScore,
          (pair) => pair.matchedTokenCount,
          (pair) => pair.commentMatchCount,
        ],
      ),
    )
    .map(({ pair }) => pair);
  const commentSupportedLowCode = indexedPairs
    .filter(
      ({ pair }) =>
        pair.similarityScore < CODE_SUSPICIOUS_THRESHOLD && pair.commentMatchCount >= 1,
    )
    .sort((left, right) =>
      compareSuspiciousPairs(
        left,
        right,
        [
          (pair) => pair.commentMatchCount,
          (pair) => pair.similarityScore,
          (pair) => pair.matchedTokenCount,
        ],
      ),
    )
    .map(({ pair }) => pair);
  const hiddenPairs = indexedPairs
    .filter(
      ({ pair }) =>
        pair.similarityScore < CODE_SUSPICIOUS_THRESHOLD && pair.commentMatchCount < 1,
    )
    .sort((left, right) => left.index - right.index)
    .map(({ pair }) => pair);

  return {
    codeSuspicious,
    commentSupportedLowCode,
    hiddenPairs,
    shownCount: codeSuspicious.length + commentSupportedLowCode.length,
    totalCount: pairs.length,
  };
}

function compareSuspiciousPairs(
  left: { pair: SuspiciousPairListItem; index: number },
  right: { pair: SuspiciousPairListItem; index: number },
  selectors: Array<(pair: SuspiciousPairListItem) => number>,
) {
  for (const selector of selectors) {
    const difference = selector(right.pair) - selector(left.pair);
    if (difference !== 0) {
      return difference;
    }
  }

  return left.index - right.index;
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
