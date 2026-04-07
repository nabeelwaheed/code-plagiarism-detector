"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Play, Download, Upload, Eye, FileText, GitCompare,
  Clock, ChevronRight, Inbox, FolderArchive, Code2, BarChart3
} from "lucide-react";
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
  const [historicalUploadError, setHistoricalUploadError] = useState<string | null>(null);
  const [templateUploadError, setTemplateUploadError] = useState<string | null>(null);
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
      setHistoricalUploadError(null);
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      pushToast({ tone: "success", title: "Historical submissions uploaded" });
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
      setTemplateUploadError(null);
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      pushToast({ tone: "success", title: "Template code uploaded" });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => createComparisonRun(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      pushToast({ tone: "success", title: "Analysis started", description: "Code comparison is now running." });
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
          <strong>Verifying session</strong>
          <p className="secondary-text">Checking your instructor credentials.</p>
        </div>
      </div>
    );
  }

  if (session.role !== "professor") {
    return (
      <section className="error-panel">
        <strong>Instructor access required</strong>
        <p>Only instructor accounts can access assignment workspaces.</p>
      </section>
    );
  }

  if (assignmentQuery.isLoading) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <strong>Loading assignment</strong>
          <p className="secondary-text">Fetching submissions and analysis results.</p>
        </div>
      </div>
    );
  }

  if (assignmentQuery.error || !assignmentQuery.data) {
    return (
      <section className="error-panel">
        <strong>Assignment not found</strong>
        <p>{assignmentQuery.error?.message ?? "This assignment may have been removed."}</p>
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
    if (!historicalFile) {
      setHistoricalUploadError("Choose a zip archive to upload historical submissions.");
      return;
    }
    setHistoricalUploadError(null);
    historicalUploadMutation.mutate();
  };

  const handleTemplateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateFile) {
      setTemplateUploadError("Choose a zip archive to upload starter or template code.");
      return;
    }
    setTemplateUploadError(null);
    templateUploadMutation.mutate();
  };

  return (
    <div className="shell-stack fade-up">
      {/* ─── Assignment Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <Link className="ghost-button button-compact" href="/professor" style={{ gap: "0.35rem" }}>
              <ArrowLeft size={13} /> Dashboard
            </Link>
            <span className={`status-pill tone-${getStatusTone(latestRun?.status)}`}>
              {latestRun ? formatStatusLabel(latestRun.status) : "Not analyzed"}
            </span>
          </div>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Assignment</p>
            <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0.2rem 0 0.35rem" }}>
              {assignment.title}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span className="status-pill tone-brand">{formatLanguageLabel(assignment.language)}</span>
              <code className="mono helper-text" style={{ fontSize: "0.8rem" }}>
                {assignment.keys[0]?.publicKey ?? "No access key"}
              </code>
              <span className="helper-text">· Created {formatDateTime(assignment.createdAt)}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="primary-button"
              type="button"
              disabled={rerunMutation.isPending}
              onClick={() => rerunMutation.mutate()}
            >
              <Play size={14} />
              {rerunMutation.isPending ? "Starting..." : "Run Analysis"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={downloadMutation.isPending || currentSubmissions.length === 0}
              onClick={() => downloadMutation.mutate({ type: "all" })}
            >
              <Download size={14} /> Download All
            </button>
          </div>
          {rerunMutation.error ? (
            <div className="error-panel" style={{ textAlign: "right" }}>
              <strong>Analysis failed to start</strong>
              <p>{rerunMutation.error.message}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Stats Overview ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
        <StatBox icon={<FileText size={14} />} label="Current" value={currentSubmissions.length} />
        <StatBox icon={<FolderArchive size={14} />} label="Historical" value={historicalSubmissions.length} />
        <StatBox icon={<Code2 size={14} />} label="Template" value={assignment.activeTemplate ? "Active" : "None"} />
        <StatBox icon={<BarChart3 size={14} />} label="Flagged Pairs" value={latestVisibleRun?.pairResults.length ?? 0} />
      </div>

      {/* ─── Main Content ─── */}
      <div className="assignment-layout">
        {!sidebarCollapsed ? (
          <aside className="assignment-sidebar">
            {/* Nav */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem 0.6rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brand)" }}>Sections</span>
                <button className="ghost-button button-compact" type="button" onClick={() => setSidebarCollapsed(true)} style={{ fontSize: "0.78rem" }}>
                  Collapse
                </button>
              </div>
              <div className="sidebar-nav" style={{ padding: "0 0.5rem 0.75rem" }}>
                <button className={`sidebar-link ${activeTab === "submissions" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("submissions")}>
                  <Inbox size={15} style={{ flexShrink: 0 }} /> Submissions
                </button>
                <button className={`sidebar-link ${activeTab === "pairs" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("pairs")}>
                  <GitCompare size={15} style={{ flexShrink: 0 }} /> Similarity Results
                </button>
                <button className={`sidebar-link ${activeTab === "activity" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("activity")}>
                  <Clock size={15} style={{ flexShrink: 0 }} /> Activity Log
                </button>
              </div>
            </div>

            {/* Latest upload status */}
            {latestUpload ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", padding: "1rem" }}>
                <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>Latest Upload</p>
                <p style={{ fontWeight: 600, fontSize: "0.9rem", margin: "0 0 0.35rem", color: "var(--text-primary)" }}>{formatUploadPurpose(latestUpload.purpose)}</p>
                <span className={`status-pill tone-${getStatusTone(latestUpload.status)}`}>{formatStatusLabel(latestUpload.status)}</span>
                <p className="helper-text" style={{ marginTop: "0.4rem" }}>{getUploadSummary(latestUpload.status, latestUpload.errorMessage)}</p>
              </div>
            ) : null}

            <UploadCard id="historical-upload" title="Historical Submissions" description="Prior-term submissions for cross-semester analysis" error={historicalUploadError} file={historicalFile} isPending={historicalUploadMutation.isPending} onChange={(file) => { setHistoricalFile(file); if (file) setHistoricalUploadError(null); }} onSubmit={handleHistoricalSubmit} />
            <UploadCard id="template-upload" title="Template / Starter Code" description="Reference code to exclude from similarity scoring" error={templateUploadError} file={templateFile} isPending={templateUploadMutation.isPending} onChange={(file) => { setTemplateFile(file); if (file) setTemplateUploadError(null); }} onSubmit={handleTemplateSubmit} />
          </aside>
        ) : (
          <aside className="assignment-sidebar">
            <button className="secondary-button" type="button" onClick={() => setSidebarCollapsed(false)}>
              <ChevronRight size={14} /> Show Sidebar
            </button>
          </aside>
        )}

        <section className="assignment-main">
          <div className="tabs" role="tablist" aria-label="Assignment workspace tabs">
            <button className={`tab-button ${activeTab === "submissions" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("submissions")}>Submissions</button>
            <button className={`tab-button ${activeTab === "pairs" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("pairs")}>Similarity Results</button>
            <button className={`tab-button ${activeTab === "activity" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("activity")}>Activity Log</button>
          </div>

          {/* ─── Submissions Tab ─── */}
          {activeTab === "submissions" ? (
            <>
              <section className="table-card">
                <div className="section-heading">
                  <div className="stack-xs">
                    <p className="eyebrow">Inventory</p>
                    <h2 className="section-title">Submissions & Templates</h2>
                  </div>
                  <span className="helper-text">Select an item to preview its contents.</span>
                </div>
                <SubmissionBlock label="Current Submissions" items={currentSubmissions} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "submission", id })} onDownload={(id) => downloadMutation.mutate({ type: "submission", id })} />
                <SubmissionBlock label="Historical Submissions" items={historicalSubmissions} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "submission", id })} onDownload={(id) => downloadMutation.mutate({ type: "submission", id })} />
                <TemplateBlock template={assignment.activeTemplate} selectedArtifactKey={selectedArtifactKey} onView={(id) => setSelectedArtifact({ type: "template", id })} onDownload={(id) => downloadMutation.mutate({ type: "template", id })} />
              </section>

              <section className="table-card">
                <div className="section-heading">
                  <div className="stack-xs">
                    <p className="eyebrow">Preview</p>
                    <h2 className="section-title">File Viewer</h2>
                  </div>
                </div>
                {!selectedArtifact ? (
                  <div className="empty-panel">
                    <div className="empty-icon" aria-hidden="true"><Eye size={20} /></div>
                    <strong>No File Selected</strong>
                    <p>Choose a submission or template above to view its source files.</p>
                  </div>
                ) : artifactDetailQuery.isLoading ? (
                  <div className="loading-card"><div className="spinner" aria-hidden="true" /><strong>Loading files</strong><p className="secondary-text">Fetching source code contents.</p></div>
                ) : artifactDetailQuery.error ? (
                  <div className="error-panel"><strong>Could not load files</strong><p>{artifactDetailQuery.error.message}</p></div>
                ) : artifactDetailQuery.data ? (
                  <ArtifactViewer artifact={artifactDetailQuery.data} revealedIdentity={revealedIdentity} isRevealPending={revealIdentityMutation.isPending} revealError={revealIdentityMutation.error?.message ?? null} onHide={() => { setRevealedIdentity(null); revealIdentityMutation.reset(); }} onReveal={artifactDetailQuery.data.kind !== "template" && artifactDetailQuery.data.identityRevealMode ? () => revealIdentityMutation.mutate(artifactDetailQuery.data.id) : null} />
                ) : null}
              </section>
            </>
          ) : null}

          {/* ─── Similarity Results Tab ─── */}
          {activeTab === "pairs" ? (
            <section className="table-card">
              <div className="section-heading">
                <div className="stack-xs">
                  <p className="eyebrow">Code Comparison</p>
                  <h2 className="section-title">Similarity Results</h2>
                </div>
                <div className="tabs" role="tablist" aria-label="Pair category">
                  <button className={`tab-button ${activePairCategory === "current-current" ? "is-active" : ""}`} type="button" onClick={() => setActivePairCategory("current-current")}>Current vs Current</button>
                  <button className={`tab-button ${activePairCategory === "current-historical" ? "is-active" : ""}`} type="button" onClick={() => setActivePairCategory("current-historical")}>Current vs Historical</button>
                </div>
              </div>
              {latestVisibleRun ? (
                <>
                  <div className="surface-soft">
                    <div className="toolbar-row">
                      <span className={`status-pill tone-${getStatusTone(latestVisibleRun.status)}`}>{formatStatusLabel(latestVisibleRun.status)}</span>
                      <span className="helper-text">{visiblePairs.length} pair{visiblePairs.length !== 1 ? "s" : ""} found</span>
                    </div>
                  </div>
                  {visiblePairs.length > 0 ? (
                    <div className="table-shell">
                      <table className="data-table">
                        <thead><tr><th>Submission Pair</th><th>Code</th><th>Comments</th><th>Matches</th><th>Priority</th><th>Action</th></tr></thead>
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
                                <td><Link className="primary-button as-link button-compact" href={`/professor/assignments/${assignment.id}/pairs/${pair.id}`}>Inspect <ChevronRight size={14} /></Link></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-panel">
                      <div className="empty-icon" aria-hidden="true"><GitCompare size={20} /></div>
                      <strong>No Matches in This Category</strong>
                      <p>The latest analysis found no flagged pairs for this filter.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-panel">
                  <div className="empty-icon" aria-hidden="true"><BarChart3 size={20} /></div>
                  <strong>No Analysis Results Yet</strong>
                  <p>Click "Run Analysis" after uploading submissions to compare code.</p>
                </div>
              )}
            </section>
          ) : null}

          {/* ─── Activity Log Tab ─── */}
          {activeTab === "activity" ? (
            <section className="table-card">
              <div className="section-heading">
                <div className="stack-xs">
                  <p className="eyebrow">History</p>
                  <h2 className="section-title">Activity Log</h2>
                </div>
              </div>
              <div className="history-list">
                {assignment.uploadBatches.map((batch) => (
                  <article className="history-item" key={batch.id}>
                    <div className="history-top">
                      <div className="stack-xs"><strong>{formatUploadPurpose(batch.purpose)}</strong><span className="helper-text">Uploaded {formatDateTime(batch.createdAt)} · Updated {formatDateTime(batch.updatedAt)}</span></div>
                      <span className={`status-pill tone-${getStatusTone(batch.status)}`}>{formatStatusLabel(batch.status)}</span>
                    </div>
                    <p className="secondary-text">{getUploadSummary(batch.status, batch.errorMessage)}</p>
                    {batch.errorMessage ? (
                      <div className="history-details">
                        {shouldCollapseMessage(batch.errorMessage) ? <details><summary>View details</summary><p>{batch.errorMessage}</p></details> : <p>{batch.errorMessage}</p>}
                      </div>
                    ) : null}
                  </article>
                ))}
                {assignment.comparisonRuns.map((run) => (
                  <article className="history-item" key={run.id}>
                    <div className="history-top">
                      <div className="stack-xs"><strong>Code Analysis — {run.engineVersion}</strong><span className="helper-text">Started {formatDateTime(run.createdAt)}{run.completedAt ? ` · Completed ${formatDateTime(run.completedAt)}` : ""}</span></div>
                      <span className={`status-pill tone-${getStatusTone(run.status)}`}>{formatStatusLabel(run.status)}</span>
                    </div>
                    <p className="secondary-text">{run.pairResults.length} pair{run.pairResults.length !== 1 ? "s" : ""} flagged in this run.</p>
                    {run.errorMessage ? (
                      <div className="history-details">
                        {shouldCollapseMessage(run.errorMessage) ? <details><summary>View details</summary><p>{run.errorMessage}</p></details> : <p>{run.errorMessage}</p>}
                      </div>
                    ) : null}
                  </article>
                ))}
                {assignment.uploadBatches.length === 0 && assignment.comparisonRuns.length === 0 ? (
                  <div className="empty-panel">
                    <div className="empty-icon" aria-hidden="true"><Clock size={20} /></div>
                    <strong>No Activity Yet</strong>
                    <p>Upload submissions or run an analysis to see activity here.</p>
                  </div>
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
      {items.length > 0 ? <div className="table-shell"><table className="data-table"><thead><tr><th>Name</th><th>Submitted</th><th>Files</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="row-title"><strong>{item.displayName}</strong><span className="helper-text">{item.kind}</span></div></td><td>{formatDateTime(item.createdAt)}</td><td>{item.fileCount}</td><td><div className="row-actions"><button className={selectedArtifactKey === `submission:${item.id}` ? "primary-button button-compact" : "secondary-button button-compact"} type="button" onClick={() => onView(item.id)}><Eye size={13} /> View</button><button className="secondary-button button-compact" type="button" onClick={() => onDownload(item.id)}><Download size={13} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-panel"><div className="empty-icon" aria-hidden="true"><Inbox size={20} /></div><strong>No Submissions Yet</strong><p>Submissions will appear here once students upload their work.</p></div>}
    </div>
  );
}

function TemplateBlock({ template, onDownload, onView, selectedArtifactKey }: { template: { id: string; versionNumber: number; createdAt: string; fileCount: number } | null; onDownload: (id: string) => void; onView: (id: string) => void; selectedArtifactKey: string | null; }) {
  return (
    <div className="card-stack">
      <div className="section-heading"><h3 className="card-title">Template / Starter Code</h3><span className={`status-pill tone-${template ? "success" : "neutral"}`}>{template ? "Active" : "Not uploaded"}</span></div>
      {template ? <div className="table-shell"><table className="data-table"><thead><tr><th>Version</th><th>Uploaded</th><th>Files</th><th>Actions</th></tr></thead><tbody><tr><td>Version {template.versionNumber}</td><td>{formatDateTime(template.createdAt)}</td><td>{template.fileCount}</td><td><div className="row-actions"><button className={selectedArtifactKey === `template:${template.id}` ? "primary-button button-compact" : "secondary-button button-compact"} type="button" onClick={() => onView(template.id)}><Eye size={13} /> View</button><button className="secondary-button button-compact" type="button" onClick={() => onDownload(template.id)}><Download size={13} /></button></div></td></tr></tbody></table></div> : <div className="empty-panel"><div className="empty-icon" aria-hidden="true"><Code2 size={20} /></div><strong>No Template Uploaded</strong><p>Upload starter code to exclude it from similarity analysis.</p></div>}
    </div>
  );
}

function ArtifactViewer({ artifact, isRevealPending, onHide, onReveal, revealError, revealedIdentity }: { artifact: AssignmentArtifactDetail; isRevealPending: boolean; onHide: () => void; onReveal: (() => void) | null; revealError: string | null; revealedIdentity: SubmissionIdentityRevealResponse | null; }) {
  return (
    <div className="artifact-viewer">
      <div className="section-card">
        <div className="artifact-header">
          <div className="stack-xs"><p className="eyebrow">{artifact.kind === "template" ? `Template v${artifact.versionNumber ?? 1}` : `${artifact.kind} submission`}</p><h3 className="card-title">{artifact.displayName}</h3><span className="helper-text">{artifact.fileCount} file{artifact.fileCount !== 1 ? "s" : ""} · {formatDateTime(artifact.createdAt)}</span></div>
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

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)", padding: "1rem 1.1rem",
      display: "flex", flexDirection: "column", gap: "0.35rem",
      boxShadow: "var(--shadow-xs)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
        {icon} {label}
      </div>
      <strong style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text-primary)" }}>
        {value}
      </strong>
    </div>
  );
}

function UploadCard({ description, error, file, id, isPending, onChange, onSubmit, title }: { description?: string; error?: string | null; file: File | null; id: string; isPending: boolean; onChange: (file: File | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; title: string; }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="sidebar-card">
      <form className="sidebar-section" noValidate onSubmit={onSubmit}>
        <div className="stack-xs">
          <p className="eyebrow">Upload</p>
          <h3 className="card-title">{title}</h3>
          {description ? <p className="helper-text">{description}</p> : null}
        </div>
        <label className={`file-dropzone${error ? " is-invalid" : ""}`} htmlFor={id} style={{ minHeight: "120px", padding: "16px" }}>
          <div className="dropzone-icon" aria-hidden="true" style={{ width: "40px", height: "40px" }}>
            <Upload size={16} />
          </div>
          <div className="stack-xs">
            <strong style={{ fontSize: "0.9rem" }}>{file ? file.name : "Choose a zip archive"}</strong>
            <span className="helper-text">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Accepted: .zip"}</span>
          </div>
          <input ref={inputRef} className="hidden-input" id={id} type="file" accept=".zip" onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] ?? null)} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button className="primary-button button-compact" disabled={isPending} type="submit">
          <Upload size={14} />
          {isPending ? "Uploading..." : "Upload"}
        </button>
      </form>
    </section>
  );
}
