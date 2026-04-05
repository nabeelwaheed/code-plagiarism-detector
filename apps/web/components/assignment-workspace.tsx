"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createComparisonRun,
  downloadAllAssignmentSubmissions,
  downloadAssignmentSubmission,
  downloadAssignmentTemplate,
  getAssignment,
  getAssignmentSubmissionDetail,
  getAssignmentTemplateDetail,
  getUploadBatch,
  revealAssignmentSubmissionIdentity,
  uploadProfessorArchive,
  type AssignmentArtifactDetail,
  type SubmissionIdentityRevealResponse,
} from "../lib/api";
import {
  formatDateTime,
  formatLanguageLabel,
  formatSimilarityPercent,
  formatStatusLabel,
  formatUploadPurpose,
  getRiskLabel,
  getRiskTone,
  getStatusTone,
  getUploadSummary,
  isLikelyJunkFile,
  shouldCollapseMessage,
} from "../lib/view-models";
import { useCurrentUserQuery } from "./auth-hooks";
import { SubmissionIdentityPanel } from "./submission-identity-panel";
import { useToast } from "./toast-provider";

type SelectedArtifact =
  | { type: "submission"; id: string }
  | { type: "template"; id: string }
  | null;

type WorkspaceTab = "submissions" | "pairs" | "activity";
type PairCategory = "current-current" | "current-historical";

export function AssignmentWorkspace({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [trackedUploadBatchId, setTrackedUploadBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("submissions");
  const [activePairCategory, setActivePairCategory] = useState<PairCategory>("current-current");
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact>(null);
  const [revealedIdentity, setRevealedIdentity] = useState<SubmissionIdentityRevealResponse | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        throw new Error("No artifact selected.");
      }

      return selectedArtifact.type === "template"
        ? getAssignmentTemplateDetail(assignmentId, selectedArtifact.id)
        : getAssignmentSubmissionDetail(assignmentId, selectedArtifact.id);
    },
    enabled: activeTab === "submissions" && Boolean(selectedArtifact),
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
      pushToast({ tone: "success", title: "Historical archive uploaded" });
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
      pushToast({ tone: "success", title: "Template archive uploaded" });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => createComparisonRun(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      pushToast({ tone: "success", title: "Comparison queued" });
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
    onSuccess: (identity) => setRevealedIdentity(identity),
  });

  useEffect(() => {
    setRevealedIdentity(null);
    revealIdentityMutation.reset();
  }, [selectedArtifact?.id, selectedArtifact?.type]);

  if (!session) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <strong>Checking professor session</strong>
          <p className="secondary-text">Sign in as a professor to open this assignment.</p>
        </div>
      </div>
    );
  }

  if (session.role !== "professor") {
    return (
      <section className="error-panel">
        <strong>Professor access required</strong>
        <p>Only professor accounts can open assignment workspaces.</p>
      </section>
    );
  }

  if (assignmentQuery.isLoading) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <strong>Loading assignment</strong>
          <p className="secondary-text">Refreshing uploads, submissions, and comparison runs.</p>
        </div>
      </div>
    );
  }

  if (assignmentQuery.error || !assignmentQuery.data) {
    return (
      <section className="error-panel">
        <strong>Assignment unavailable</strong>
        <p>{assignmentQuery.error?.message ?? "That assignment no longer exists."}</p>
      </section>
    );
  }

  const assignment = assignmentQuery.data;
  const currentSubmissions = assignment.submissions.filter((item) => item.kind === "current");
  const historicalSubmissions = assignment.submissions.filter((item) => item.kind === "historical");
  const latestRun = assignment.comparisonRuns[0] ?? null;
  const latestVisibleRun =
    assignment.comparisonRuns.find((run) => run.status === "completed" && run.pairResults.length > 0)
    ?? latestRun;
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

  const handleHistoricalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (historicalFile) {
      historicalUploadMutation.mutate();
    }
  };

  const handleTemplateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (templateFile) {
      templateUploadMutation.mutate();
    }
  };

  return (
    <div className="shell-stack fade-up">
      <section className="hero-card">
        <div className="hero-grid">
          <div className="card-stack">
            <div className="toolbar-row">
              <Link className="secondary-button as-link" href="/professor">
                Back to professor home
              </Link>
              <span className={`status-pill tone-${getStatusTone(latestRun?.status)}`}>
                {latestRun ? formatStatusLabel(latestRun.status) : "No run yet"}
              </span>
            </div>
            <div className="stack-sm">
              <p className="eyebrow">Assignment Workspace</p>
              <h1 className="page-title">{assignment.title}</h1>
              <p className="secondary-text">
                Structured review for uploads, artifacts, and suspicious pairs.
              </p>
            </div>
            <div className="toolbar-row">
              <span className="status-pill tone-brand">{formatLanguageLabel(assignment.language)}</span>
              <span className="status-pill tone-neutral mono">
                {assignment.keys[0]?.publicKey ?? "No active key"}
              </span>
              <span className="helper-text">Created {formatDateTime(assignment.createdAt)}</span>
            </div>
          </div>
          <div className="card-stack">
            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                disabled={rerunMutation.isPending}
                onClick={() => rerunMutation.mutate()}
              >
                {rerunMutation.isPending ? "Queueing..." : "Run comparison"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={downloadMutation.isPending || currentSubmissions.length === 0}
                onClick={() => downloadMutation.mutate({ type: "all" })}
              >
                Download current submissions
              </button>
            </div>
            {rerunMutation.error ? (
              <div className="error-panel">
                <strong>Comparison request failed</strong>
                <p>{rerunMutation.error.message}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="stat-card"><span>Current</span><strong>{currentSubmissions.length}</strong></div>
        <div className="stat-card"><span>Historical</span><strong>{historicalSubmissions.length}</strong></div>
        <div className="stat-card"><span>Template</span><strong>{assignment.activeTemplate ? 1 : 0}</strong></div>
        <div className="stat-card"><span>Visible pairs</span><strong>{latestVisibleRun?.pairResults.length ?? 0}</strong></div>
      </section>

      <div className="assignment-layout">
        {!sidebarCollapsed ? (
          <aside className="assignment-sidebar">
            <section className="sidebar-card">
              <div className="section-heading">
                <div className="stack-xs">
                  <p className="eyebrow">Navigate</p>
                  <h2 className="card-title">Sections</h2>
                </div>
                <button className="ghost-button button-compact" type="button" onClick={() => setSidebarCollapsed(true)}>
                  Collapse
                </button>
              </div>
              <div className="sidebar-nav">
                <button className={`sidebar-link ${activeTab === "submissions" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("submissions")}>Submissions</button>
                <button className={`sidebar-link ${activeTab === "pairs" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("pairs")}>Suspicious pairs</button>
                <button className={`sidebar-link ${activeTab === "activity" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("activity")}>Activity</button>
              </div>
            </section>

            <section className="sidebar-card">
              <div className="stack-xs">
                <p className="eyebrow">Latest upload</p>
                <h3 className="card-title">{latestUpload ? formatUploadPurpose(latestUpload.purpose) : "No upload yet"}</h3>
                {latestUpload ? (
                  <>
                    <span className={`status-pill tone-${getStatusTone(latestUpload.status)}`}>{formatStatusLabel(latestUpload.status)}</span>
                    <p className="secondary-text">{getUploadSummary(latestUpload.status, latestUpload.errorMessage)}</p>
                  </>
                ) : (
                  <p className="secondary-text">Upload activity appears here once processing begins.</p>
                )}
              </div>
            </section>

            <UploadCard id="historical-upload" title="Historical submissions" file={historicalFile} isPending={historicalUploadMutation.isPending} onChange={setHistoricalFile} onSubmit={handleHistoricalSubmit} />
            <UploadCard id="template-upload" title="Template code" file={templateFile} isPending={templateUploadMutation.isPending} onChange={setTemplateFile} onSubmit={handleTemplateSubmit} />
          </aside>
        ) : (
          <aside className="assignment-sidebar">
            <button className="secondary-button" type="button" onClick={() => setSidebarCollapsed(false)}>Expand sidebar</button>
          </aside>
        )}

        <section className="assignment-main">
          <div className="tabs" role="tablist" aria-label="Assignment workspace tabs">
            <button className={`tab-button ${activeTab === "submissions" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("submissions")}>Submissions</button>
            <button className={`tab-button ${activeTab === "pairs" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("pairs")}>Suspicious pairs</button>
            <button className={`tab-button ${activeTab === "activity" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("activity")}>Activity</button>
          </div>

          {activeTab === "submissions" ? (
            <>
              <section className="table-card">
                <div className="section-heading">
                  <div className="stack-xs">
                    <p className="eyebrow">Artifacts</p>
                    <h2 className="section-title">Submission inventory</h2>
                  </div>
                  <span className="helper-text">Select an item to open it in the viewer.</span>
                </div>
                <SubmissionBlock label="Current submissions" items={currentSubmissions} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "submission", id })} onDownload={(id) => downloadMutation.mutate({ type: "submission", id })} />
                <SubmissionBlock label="Historical submissions" items={historicalSubmissions} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "submission", id })} onDownload={(id) => downloadMutation.mutate({ type: "submission", id })} />
                <TemplateBlock template={assignment.activeTemplate} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "template", id })} onDownload={(id) => downloadMutation.mutate({ type: "template", id })} />
              </section>

              <section className="table-card">
                <div className="section-heading">
                  <div className="stack-xs">
                    <p className="eyebrow">Viewer</p>
                    <h2 className="section-title">Artifact contents</h2>
                  </div>
                </div>
                {!selectedArtifact ? (
                  <div className="empty-panel"><div className="empty-icon" aria-hidden="true">#</div><strong>Select an artifact</strong><p>Use the inventory above to open a submission or template.</p></div>
                ) : artifactDetailQuery.isLoading ? (
                  <div className="loading-card"><div className="spinner" aria-hidden="true" /><strong>Loading artifact</strong><p className="secondary-text">Fetching file contents.</p></div>
                ) : artifactDetailQuery.error ? (
                  <div className="error-panel"><strong>Artifact unavailable</strong><p>{artifactDetailQuery.error.message}</p></div>
                ) : artifactDetailQuery.data ? (
                  <ArtifactViewer artifact={artifactDetailQuery.data} revealedIdentity={revealedIdentity} isRevealPending={revealIdentityMutation.isPending} revealError={revealIdentityMutation.error?.message ?? null} onHide={() => { setRevealedIdentity(null); revealIdentityMutation.reset(); }} onReveal={artifactDetailQuery.data.kind !== "template" && artifactDetailQuery.data.identityRevealMode ? () => revealIdentityMutation.mutate(artifactDetailQuery.data.id) : null} />
                ) : null}
              </section>
            </>
          ) : null}

          {activeTab === "pairs" ? (
            <section className="table-card">
              <div className="section-heading">
                <div className="stack-xs">
                  <p className="eyebrow">Suspicious pairs</p>
                  <h2 className="section-title">Latest visible comparison results</h2>
                </div>
                <div className="tabs" role="tablist" aria-label="Pair category tabs">
                  <button className={`tab-button ${activePairCategory === "current-current" ? "is-active" : ""}`} type="button" onClick={() => setActivePairCategory("current-current")}>Current vs current</button>
                  <button className={`tab-button ${activePairCategory === "current-historical" ? "is-active" : ""}`} type="button" onClick={() => setActivePairCategory("current-historical")}>Current vs historical</button>
                </div>
              </div>
              {latestVisibleRun ? (
                <>
                  <div className="surface-soft">
                    <div className="toolbar-row">
                      <span className={`status-pill tone-${getStatusTone(latestVisibleRun.status)}`}>{formatStatusLabel(latestVisibleRun.status)}</span>
                      <span className="helper-text">Run {latestVisibleRun.id}</span>
                      <span className="helper-text">{visiblePairs.length} pair(s) in this view</span>
                    </div>
                  </div>
                  {visiblePairs.length > 0 ? (
                    <div className="table-shell">
                      <table className="data-table">
                        <thead><tr><th>Pair</th><th>Code</th><th>Comments</th><th>Matches</th><th>Priority</th><th>Review</th></tr></thead>
                        <tbody>
                          {visiblePairs.map((pair) => {
                            const riskValue = Math.max(pair.similarityScore, pair.commentScore ?? 0);
                            return (
                              <tr key={pair.id}>
                                <td><div className="row-title"><strong>{pair.leftSubmission.displayName} vs {pair.rightSubmission.displayName}</strong><span className="helper-text">{pair.leftSubmission.kind} vs {pair.rightSubmission.kind}</span></div></td>
                                <td>{formatSimilarityPercent(pair.similarityScore)}</td>
                                <td>{formatSimilarityPercent(pair.commentScore)}</td>
                                <td>{pair.matchCount}</td>
                                <td><span className={`status-pill tone-${getRiskTone(riskValue)}`}>{getRiskLabel(riskValue)}</span></td>
                                <td><Link className="primary-button as-link" href={`/professor/assignments/${assignment.id}/pairs/${pair.id}`}>Open reviewer</Link></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-panel"><div className="empty-icon" aria-hidden="true">0</div><strong>No pairs in this category</strong><p>The latest visible run has no results for this filter.</p></div>
                  )}
                </>
              ) : (
                <div className="empty-panel"><div className="empty-icon" aria-hidden="true">R</div><strong>No comparison results yet</strong><p>Queue a run after uploads finish processing.</p></div>
              )}
            </section>
          ) : null}

          {activeTab === "activity" ? (
            <section className="table-card">
              <div className="section-heading">
                <div className="stack-xs">
                  <p className="eyebrow">Activity</p>
                  <h2 className="section-title">Uploads and run history</h2>
                </div>
              </div>
              <div className="history-list">
                {assignment.uploadBatches.map((batch) => (
                  <article className="history-item" key={batch.id}>
                    <div className="history-top">
                      <div className="stack-xs"><strong>{formatUploadPurpose(batch.purpose)}</strong><span className="helper-text">Created {formatDateTime(batch.createdAt)} · Updated {formatDateTime(batch.updatedAt)}</span></div>
                      <span className={`status-pill tone-${getStatusTone(batch.status)}`}>{formatStatusLabel(batch.status)}</span>
                    </div>
                    <p className="secondary-text">{getUploadSummary(batch.status, batch.errorMessage)}</p>
                    {batch.errorMessage ? (
                      <div className="history-details">
                        {shouldCollapseMessage(batch.errorMessage) ? <details><summary>View full message</summary><p>{batch.errorMessage}</p></details> : <p>{batch.errorMessage}</p>}
                      </div>
                    ) : null}
                  </article>
                ))}
                {assignment.comparisonRuns.map((run) => (
                  <article className="history-item" key={run.id}>
                    <div className="history-top">
                      <div className="stack-xs"><strong>{run.engineVersion}</strong><span className="helper-text">Started {formatDateTime(run.createdAt)}{run.completedAt ? ` · Completed ${formatDateTime(run.completedAt)}` : ""}</span></div>
                      <span className={`status-pill tone-${getStatusTone(run.status)}`}>{formatStatusLabel(run.status)}</span>
                    </div>
                    <p className="secondary-text">{run.pairResults.length} pair(s) in this run.</p>
                    {run.errorMessage ? (
                      <div className="history-details">
                        {shouldCollapseMessage(run.errorMessage) ? <details><summary>View full message</summary><p>{run.errorMessage}</p></details> : <p>{run.errorMessage}</p>}
                      </div>
                    ) : null}
                  </article>
                ))}
                {assignment.uploadBatches.length === 0 && assignment.comparisonRuns.length === 0 ? (
                  <div className="empty-panel"><div className="empty-icon" aria-hidden="true">A</div><strong>No activity yet</strong><p>Uploads and comparison history will appear here.</p></div>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function SubmissionBlock({ label, items, onDownload, onView, selectedArtifactKey }: { label: string; items: Array<{ id: string; displayName: string; kind: "current" | "historical"; createdAt: string; fileCount: number }>; onDownload: (id: string) => void; onView: (id: string) => void; selectedArtifactKey: string | null; }) {
  return (
    <div className="card-stack">
      <div className="section-heading"><h3 className="card-title">{label}</h3><span className="status-pill tone-neutral">{items.length}</span></div>
      {items.length > 0 ? <div className="table-shell"><table className="data-table"><thead><tr><th>Name</th><th>Created</th><th>Files</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="row-title"><strong>{item.displayName}</strong><span className="helper-text">{item.kind}</span></div></td><td>{formatDateTime(item.createdAt)}</td><td>{item.fileCount}</td><td><div className="row-actions"><button className={selectedArtifactKey === `submission:${item.id}` ? "primary-button button-compact" : "secondary-button button-compact"} type="button" onClick={() => onView(item.id)}>View</button><button className="secondary-button button-compact" type="button" onClick={() => onDownload(item.id)}>Download</button></div></td></tr>)}</tbody></table></div> : <div className="empty-panel"><div className="empty-icon" aria-hidden="true">0</div><strong>No items yet</strong><p>This section will populate after uploads finish.</p></div>}
    </div>
  );
}

function TemplateBlock({ template, onDownload, onView, selectedArtifactKey }: { template: { id: string; versionNumber: number; createdAt: string; fileCount: number } | null; onDownload: (id: string) => void; onView: (id: string) => void; selectedArtifactKey: string | null; }) {
  return (
    <div className="card-stack">
      <div className="section-heading"><h3 className="card-title">Template code</h3><span className={`status-pill tone-${template ? "success" : "neutral"}`}>{template ? "Active" : "Missing"}</span></div>
      {template ? <div className="table-shell"><table className="data-table"><thead><tr><th>Version</th><th>Created</th><th>Files</th><th>Actions</th></tr></thead><tbody><tr><td>Version {template.versionNumber}</td><td>{formatDateTime(template.createdAt)}</td><td>{template.fileCount}</td><td><div className="row-actions"><button className={selectedArtifactKey === `template:${template.id}` ? "primary-button button-compact" : "secondary-button button-compact"} type="button" onClick={() => onView(template.id)}>View</button><button className="secondary-button button-compact" type="button" onClick={() => onDownload(template.id)}>Download</button></div></td></tr></tbody></table></div> : <div className="empty-panel"><div className="empty-icon" aria-hidden="true">T</div><strong>No template uploaded</strong><p>Template code is tracked separately from suspicious pairs.</p></div>}
    </div>
  );
}

function ArtifactViewer({ artifact, isRevealPending, onHide, onReveal, revealError, revealedIdentity }: { artifact: AssignmentArtifactDetail; isRevealPending: boolean; onHide: () => void; onReveal: (() => void) | null; revealError: string | null; revealedIdentity: SubmissionIdentityRevealResponse | null; }) {
  return (
    <div className="artifact-viewer">
      <div className="section-card">
        <div className="artifact-header">
          <div className="stack-xs"><p className="eyebrow">{artifact.kind === "template" ? `Template version ${artifact.versionNumber ?? 1}` : `${artifact.kind} submission`}</p><h3 className="card-title">{artifact.displayName}</h3><span className="helper-text">{artifact.fileCount} file(s) · {formatDateTime(artifact.createdAt)}</span></div>
          <span className={`status-pill tone-${artifact.kind === "template" ? "success" : "neutral"}`}>{artifact.kind === "template" ? "Template" : artifact.kind}</span>
        </div>
        {artifact.kind !== "template" ? <SubmissionIdentityPanel identityRevealMode={artifact.identityRevealMode} revealedIdentity={revealedIdentity} isRevealPending={isRevealPending} revealError={revealError} onReveal={onReveal} onHide={onHide} /> : null}
      </div>
      <div className="artifact-list">
        {artifact.files.map((file) => { const junk = isLikelyJunkFile(file.relativePath, file.archivePath); return <article className="artifact-card" key={file.id}><div className="artifact-header"><div className="stack-xs"><span className="artifact-subpath">{file.archivePath ?? "Source file"}</span><span className="artifact-path mono">{file.relativePath}</span></div><span className={`status-pill tone-${junk ? "neutral" : "success"}`}>{junk ? "System file" : "Source"}</span></div><div className="code-surface"><div className="code-surface-head"><span className="mono">{file.relativePath}</span></div><pre>{file.contents}</pre></div></article>; })}
      </div>
    </div>
  );
}

function UploadCard({ file, id, isPending, onChange, onSubmit, title }: { file: File | null; id: string; isPending: boolean; onChange: (file: File | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; title: string; }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="sidebar-card">
      <form className="sidebar-section" onSubmit={onSubmit}>
        <div className="stack-xs"><p className="eyebrow">Upload</p><h3 className="card-title">{title}</h3></div>
        <label className="file-dropzone" htmlFor={id}>
          <div className="dropzone-icon" aria-hidden="true">↑</div>
          <div className="stack-xs"><strong>{file ? file.name : "Choose a zip archive"}</strong><span className="helper-text">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Accepted format: .zip"}</span></div>
          <button className="secondary-button button-compact" type="button" onClick={(event) => { event.preventDefault(); inputRef.current?.click(); }}>Browse</button>
          <input ref={inputRef} className="hidden-input" id={id} type="file" accept=".zip" onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] ?? null)} />
        </label>
        <button className="primary-button" disabled={!file || isPending} type="submit">{isPending ? "Uploading..." : "Upload archive"}</button>
      </form>
    </section>
  );
}
