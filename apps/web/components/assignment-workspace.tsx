"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock,
  Database,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileCode,
  Home,
  Key,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
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
  type AssignmentArtifactDetail,
  type AssignmentDetail,
  type SubmissionIdentityRevealResponse,
} from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { SubmissionIdentityPanel } from "./submission-identity-panel";
import { ConfirmModal } from "./confirm-modal";
import { useToast } from "./toast";

type WorkspaceTab = "submissions" | "pairs" | "uploads" | "danger";

type SelectedArtifact =
  | { type: "submission"; id: string }
  | { type: "template"; id: string }
  | null;

type AssignmentSubmissionListItem = AssignmentDetail["submissions"][number];

type SubmissionDeleteTarget = {
  id: string;
  displayName: string;
  kind: AssignmentSubmissionListItem["kind"];
  createdAt: string;
  fileCount: number;
};

type SubmissionDeleteLookupState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "valid"; message: string; match: SubmissionDeleteTarget };

const CODE_SUSPICIOUS_THRESHOLD = 0.35;

function getPastDueDateFeedback(dueDate: string) {
  if (!dueDate.trim()) return null;

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.getTime() < Date.now() ? "Please choose a future date and time." : null;
}

export function AssignmentWorkspace({
  assignmentId,
  initialTab = "submissions",
}: {
  assignmentId: string;
  initialTab?: WorkspaceTab;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [trackedUploadBatchId, setTrackedUploadBatchId] = useState<string | null>(null);
  const [activePairCategory, setActivePairCategory] = useState<"current-current" | "current-historical">("current-current");
  const [showAllPairs, setShowAllPairs] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact>(null);
  const [revealedIdentity, setRevealedIdentity] = useState<SubmissionIdentityRevealResponse | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Delete confirm modals
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState(false);
  const [confirmDeleteSubmission, setConfirmDeleteSubmission] = useState<SubmissionDeleteTarget | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<{ id: string; version: number } | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ cat: "current" | "historical" | "template"; count: number } | null>(null);
  const [deleteSubmissionInput, setDeleteSubmissionInput] = useState("");
  const [deleteSubmissionLookup, setDeleteSubmissionLookup] = useState<SubmissionDeleteLookupState>({
    status: "idle",
    message: "Enter the exact submission name or unique submission ID, then validate it here before deleting.",
  });

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
      if (!selectedArtifact) throw new Error("No artifact selected");
      return selectedArtifact.type === "template"
        ? getAssignmentTemplateDetail(assignmentId, selectedArtifact.id)
        : getAssignmentSubmissionDetail(assignmentId, selectedArtifact.id);
    },
    enabled: activeTab === "submissions" && Boolean(selectedArtifact),
  });

  const historicalUploadMutation = useMutation({
    mutationFn: () =>
      uploadProfessorArchive({ assignmentId, purpose: "historical_submission", file: historicalFile! }),
    onSuccess: (batch) => {
      setTrackedUploadBatchId(batch.id);
      setHistoricalFile(null);
      showToast("Historical archive uploaded. Processing...", "success");
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const templateUploadMutation = useMutation({
    mutationFn: () =>
      uploadProfessorArchive({ assignmentId, purpose: "template_upload", file: templateFile! }),
    onSuccess: (batch) => {
      setTrackedUploadBatchId(batch.id);
      setTemplateFile(null);
      showToast("Template archive uploaded. Processing...", "success");
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const rerunMutation = useMutation({
    mutationFn: () => createComparisonRun(assignmentId),
    onSuccess: () => {
      showToast("Comparison run queued.", "success");
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const downloadMutation = useMutation({
    mutationFn: async (input: { type: "all" } | { type: "submission"; id: string } | { type: "template"; id: string }) => {
      if (input.type === "all") { await downloadAllAssignmentSubmissions(assignmentId); return; }
      if (input.type === "template") { await downloadAssignmentTemplate(assignmentId, input.id); return; }
      await downloadAssignmentSubmission(assignmentId, input.id);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const revealIdentityMutation = useMutation({
    mutationFn: (submissionId: string) => revealAssignmentSubmissionIdentity(assignmentId, submissionId),
    onSuccess: (identity) => setRevealedIdentity(identity),
    onError: (err: Error) => showToast(err.message, "error"),
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
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: (submissionId: string) => deleteAssignmentSubmission(assignmentId, submissionId),
    onSuccess: async () => {
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      setDeleteSubmissionInput("");
      setDeleteSubmissionLookup({
        status: "idle",
        message:
          "Enter the exact submission name or unique submission ID, then validate it here before deleting.",
      });
      revealIdentityMutation.reset();
      showToast("Submission deleted. Comparison data cleared.", "info");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteAssignmentTemplate(assignmentId, templateId),
    onSuccess: async () => {
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      revealIdentityMutation.reset();
      showToast("Template deleted. Comparison data cleared.", "info");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (category: "current" | "historical" | "template") =>
      deleteAssignmentCategory(assignmentId, category),
    onSuccess: async (result, category) => {
      setSelectedArtifact(null);
      setRevealedIdentity(null);
      revealIdentityMutation.reset();
      const label = category === "template" ? "template" : `${category} submission`;
      showToast(
        result.deletedCount > 0
          ? `Deleted ${result.deletedCount} ${label}${result.deletedCount === 1 ? "" : "s"}. Comparison data cleared.`
          : `No ${label}s to delete.`,
        "info",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const updateDueDateMutation = useMutation({
    mutationFn: (nextDueDate: string | null) => updateAssignmentDueDate(assignmentId, nextDueDate),
    onSuccess: async (result) => {
      showToast(result.dueDate ? "Due date updated." : "Due date cleared.", "success");
      setIsEditingDueDate(false);
      setDueDateInput(toDateTimeLocalInputValue(result.dueDate));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] }),
      ]);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const handleValidateDeleteSubmission = () => {
    setDeleteSubmissionLookup(
      resolveSubmissionDeleteLookup(assignmentQuery.data?.submissions ?? [], deleteSubmissionInput),
    );
  };

  const toggleSelectedArtifact = (nextArtifact: Exclude<SelectedArtifact, null>) => {
    setSelectedArtifact((current) =>
      current?.type === nextArtifact.type && current.id === nextArtifact.id ? null : nextArtifact,
    );
  };

  const latestVisibleRun = useMemo(
    () =>
      assignmentQuery.data?.comparisonRuns.find(
        (run) => run.status === "completed",
      ) ?? assignmentQuery.data?.comparisonRuns[0],
    [assignmentQuery.data],
  );
  const latestRun = assignmentQuery.data?.comparisonRuns[0] ?? null;

  useEffect(() => {
    setRevealedIdentity(null);
    revealIdentityMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtifact?.id, selectedArtifact?.type]);

  useEffect(() => {
    setDueDateInput(toDateTimeLocalInputValue(assignmentQuery.data?.dueDate ?? null));
  }, [assignmentQuery.data?.dueDate]);

  useEffect(() => {
    setDeleteSubmissionLookup((currentState) => {
      if (currentState.status !== "valid") {
        return currentState;
      }

      const stillExists = (assignmentQuery.data?.submissions ?? []).some(
        (submission) => submission.id === currentState.match.id,
      );

      return stillExists
        ? currentState
        : {
            status: "idle",
            message:
              "Enter the exact submission name or unique submission ID, then validate it here before deleting.",
          };
    });
  }, [assignmentQuery.data?.submissions]);

  if (!session) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Sign in as a professor to open this assignment workspace.</div>;
  }

  if (session.role !== "professor") {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Only professor accounts can view assignment workspaces.</div>;
  }

  if (assignmentQuery.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: "0.75rem", color: "var(--text-tertiary)" }}>
        <Loader2 size={20} className="anim-spin" /> Loading assignment...
      </div>
    );
  }

  if (assignmentQuery.error || !assignmentQuery.data) {
    return (
      <div className="alert alert-error" style={{ margin: "2rem auto", maxWidth: 500 }}>
        {assignmentQuery.error?.message ?? "That assignment no longer exists."}
      </div>
    );
  }

  const assignment = assignmentQuery.data;
  const currentSubmissions = assignment.submissions.filter((s) => s.kind === "current");
  const historicalSubmissions = assignment.submissions.filter((s) => s.kind === "historical");
  const templateVersions = assignment.templateVersions;
  const latestUpload = trackedUploadQuery.data ?? assignment.uploadBatches[0] ?? null;
  const activeKey = assignment.keys[0]?.publicKey ?? null;
  const comparisonStatus = assignment.comparisonStatus;

  const currentVsCurrentPairs = latestVisibleRun?.pairResults.filter(
    (p) => p.leftSubmission.kind === "current" && p.rightSubmission.kind === "current",
  ) ?? [];
  const currentVsHistoricalPairs = latestVisibleRun?.pairResults.filter(
    (p) =>
      (p.leftSubmission.kind === "current" && p.rightSubmission.kind === "historical") ||
      (p.leftSubmission.kind === "historical" && p.rightSubmission.kind === "current"),
  ) ?? [];
  const visiblePairs = activePairCategory === "current-current" ? currentVsCurrentPairs : currentVsHistoricalPairs;
  const sectionedPairs = partitionSuspiciousPairs(visiblePairs);

  const selectedArtifactKey = selectedArtifact ? `${selectedArtifact.type}:${selectedArtifact.id}` : null;
  const selectedSubmissionId = selectedArtifact?.type === "submission" ? selectedArtifact.id : null;
  const selectedSubmissionDetail = selectedArtifact?.type === "submission" ? artifactDetailQuery.data : undefined;
  const selectedTemplateDetail = selectedArtifact?.type === "template" ? artifactDetailQuery.data : undefined;
  const hasActiveJobs =
    assignment.uploadBatches.some((b) => b.status === "received" || b.status === "processing") ||
    assignment.comparisonRuns.some((r) => r.status === "queued" || r.status === "running");
  const canRunComparison = assignment.canRunComparison && !rerunMutation.isPending;
  const dueDateFeedback = getPastDueDateFeedback(dueDateInput);
  const isDangerPending =
    deleteAssignmentMutation.isPending ||
    deleteSubmissionMutation.isPending ||
    deleteTemplateMutation.isPending ||
    deleteCategoryMutation.isPending;

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "submissions", label: "Submissions", icon: <Users size={17} />, badge: currentSubmissions.length + historicalSubmissions.length },
    { id: "pairs", label: "Suspicious Pairs", icon: <Database size={17} />, badge: sectionedPairs.totalCount },
    { id: "uploads", label: "Uploads", icon: <Upload size={17} />, badge: assignment.uploadBatches.length },
    { id: "danger", label: "Danger Zone", icon: <AlertTriangle size={17} /> },
  ];

  return (
    <>
      {/* Confirm modals */}
      <ConfirmModal
        open={confirmDeleteAssignment}
        title="Delete Assignment"
        message={`This will permanently remove "${assignment.title}" and all of its data — uploads, submissions, comparison results, and artifact files. This cannot be undone.`}
        confirmLabel="Delete Assignment"
        danger
        onConfirm={() => { setConfirmDeleteAssignment(false); deleteAssignmentMutation.mutate(); }}
        onCancel={() => setConfirmDeleteAssignment(false)}
      />
      <ConfirmModal
        open={Boolean(confirmDeleteSubmission)}
        title="Delete Submission"
        message="This permanently deletes the matched submission and clears comparison results for this assignment."
        confirmLabel="Delete"
        danger
        details={
          confirmDeleteSubmission ? (
            <SubmissionDeletePreview submission={confirmDeleteSubmission} />
          ) : undefined
        }
        onConfirm={() => {
          if (confirmDeleteSubmission) {
            deleteSubmissionMutation.mutate(confirmDeleteSubmission.id);
          }
          setConfirmDeleteSubmission(null);
        }}
        onCancel={() => setConfirmDeleteSubmission(null)}
      />
      <ConfirmModal
        open={Boolean(confirmDeleteTemplate)}
        title="Delete Template Version"
        message={`Delete template version ${confirmDeleteTemplate?.version}? This will also clear comparison results for this assignment.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirmDeleteTemplate) {
            deleteTemplateMutation.mutate(confirmDeleteTemplate.id);
          }
          setConfirmDeleteTemplate(null);
        }}
        onCancel={() => setConfirmDeleteTemplate(null)}
      />
      <ConfirmModal
        open={Boolean(confirmDeleteCategory)}
        title={`Delete All ${capitalizeLabel(confirmDeleteCategory?.cat ?? "")}`}
        message={`Delete all ${confirmDeleteCategory?.count} ${confirmDeleteCategory?.cat} item(s)? This will also clear comparison results for this assignment.`}
        confirmLabel="Delete All"
        danger
        onConfirm={() => {
          if (confirmDeleteCategory) {
            deleteCategoryMutation.mutate(confirmDeleteCategory.cat);
          }
          setConfirmDeleteCategory(null);
        }}
        onCancel={() => setConfirmDeleteCategory(null)}
      />

      {/* Page layout */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header bar */}
        <div
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0.65rem 1rem",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginBottom: "0.6rem",
            }}
          >
            <button
              onClick={() => router.push("/professor")}
              className="btn btn-ghost btn-sm"
              style={{ padding: "0.25rem 0.5rem", color: "var(--text-secondary)" }}
            >
              <ArrowLeft size={15} /> Back to Dashboard
            </button>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link
                href={`/professor/help?returnTo=${encodeURIComponent(`/professor/assignments/${assignmentId}`)}`}
                className="btn btn-outline btn-sm"
                style={{ textDecoration: "none" }}
              >
                <CircleHelp size={14} />
                Instructor Guide
              </Link>
              <Link
                href="/"
                className="btn btn-outline btn-sm"
                style={{ textDecoration: "none" }}
              >
                <Home size={14} />
                Student Portal Access
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <h1 style={{ fontSize: "1.35rem", margin: 0 }}>{assignment.title}</h1>
                <span className={`status-badge badge-${assignment.language.toLowerCase()}`}>
                  {assignment.language.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1rem", color: "var(--text-secondary)", fontSize: "0.8rem", flexWrap: "wrap" }}>
                {activeKey && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Key size={13} />
                    <span className="mono">{activeKey}</span>
                  </span>
                )}
                {assignment.dueDate && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Clock size={13} /> Due: {new Date(assignment.dueDate).toLocaleDateString()}
                  </span>
                )}
                {latestRun && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className={`status-badge ${getBadgeClass(comparisonStatus)}`} style={{ padding: "0.1rem 0.45rem", fontSize: "0.68rem" }}>
                      {formatComparisonStatusLabel(comparisonStatus)}
                    </span>
                    {latestVisibleRun?.pairResults.length ?? 0} pairs
                  </span>
                )}
                {!latestRun && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className={`status-badge ${getBadgeClass(comparisonStatus)}`} style={{ padding: "0.1rem 0.45rem", fontSize: "0.68rem" }}>
                      {formatComparisonStatusLabel(comparisonStatus)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                className="btn btn-outline"
                disabled={downloadMutation.isPending || currentSubmissions.length === 0}
                onClick={() => downloadMutation.mutate({ type: "all" })}
              >
                {downloadMutation.isPending ? <Loader2 size={15} className="anim-spin" /> : <Download size={15} />}
                Download
              </button>
              <button
                className="btn btn-primary"
                disabled={!canRunComparison}
                onClick={() => rerunMutation.mutate()}
              >
                {rerunMutation.isPending ? <Loader2 size={15} className="anim-spin" /> : <Play size={15} fill="currentColor" />}
                {rerunMutation.isPending ? "Queueing..." : "Run Comparison"}
              </button>
            </div>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar */}
          <aside
            style={{
              width: isSidebarCollapsed ? "68px" : "220px",
              background: "var(--bg-surface-raised)",
              borderRight: "1px solid var(--border-subtle)",
              padding: "0.6rem 0.45rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
              flexShrink: 0,
              transition: "width 0.2s ease",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isSidebarCollapsed ? "center" : "space-between",
                padding: isSidebarCollapsed ? "0" : "0 0.35rem",
                marginBottom: "0.25rem",
              }}
            >
              {!isSidebarCollapsed && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
                  Workspace
                </span>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setIsSidebarCollapsed((v) => !v)}
                style={{ padding: "0.25rem 0.4rem" }}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
              </button>
            </div>

            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                style={{
                  justifyContent: isSidebarCollapsed ? "center" : "flex-start",
                  padding: isSidebarCollapsed ? "0.65rem 0.4rem" : undefined,
                  color: tab.id === "danger" && activeTab !== tab.id ? "var(--accent-red)" : undefined,
                }}
              >
                {tab.icon}
                {!isSidebarCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          background: "var(--bg-surface)",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "var(--radius-full)",
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </aside>

          {/* Main content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>

            {/* ── SUBMISSIONS TAB ── */}
            {activeTab === "submissions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Stats */}
                <div className="stat-grid">
                  <div className="stat-tile">
                    <div className="stat-tile-label">Current</div>
                    <div className="stat-tile-value">{currentSubmissions.length}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Historical</div>
                    <div className="stat-tile-value">{historicalSubmissions.length}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Templates</div>
                    <div className="stat-tile-value">{templateVersions.length}</div>
                  </div>
                </div>

                {/* Current submissions */}
                <SectionBox
                  title="Current Submissions"
                  badge={currentSubmissions.length}
                  action={
                    currentSubmissions.length > 0 ? (
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={downloadMutation.isPending}
                        onClick={() => downloadMutation.mutate({ type: "all" })}
                      >
                        <Download size={13} /> Download All
                      </button>
                    ) : undefined
                  }
                >
                  {currentSubmissions.length === 0 ? (
                    <div className="empty-state" style={{ padding: "1.5rem" }}>
                      <p style={{ fontSize: "0.875rem" }}>No current submissions yet.</p>
                    </div>
                  ) : (
                    <SubmissionTable
                      submissions={currentSubmissions}
                      selectedSubmissionId={selectedSubmissionId}
                      selectedArtifactDetail={selectedSubmissionDetail}
                      detailIsLoading={selectedArtifact?.type === "submission" && artifactDetailQuery.isLoading}
                      detailErrorMessage={selectedArtifact?.type === "submission" ? artifactDetailQuery.error?.message ?? null : null}
                      revealErrorMessage={revealIdentityMutation.error?.message ?? null}
                      isRevealPending={revealIdentityMutation.isPending}
                      revealedIdentity={revealedIdentity}
                      onHideIdentity={() => {
                        setRevealedIdentity(null);
                        revealIdentityMutation.reset();
                      }}
                      onRevealIdentity={(id) => revealIdentityMutation.mutate(id)}
                      onToggleSelect={(id) => toggleSelectedArtifact({ type: "submission", id })}
                      onDownload={(id) => downloadMutation.mutate({ type: "submission", id })}
                    />
                  )}
                </SectionBox>

                {/* Historical submissions */}
                <SectionBox title="Historical Submissions" badge={historicalSubmissions.length}>
                  {historicalSubmissions.length === 0 ? (
                    <div className="empty-state" style={{ padding: "1.5rem" }}>
                      <p style={{ fontSize: "0.875rem" }}>No historical submissions yet. Upload historical archives in the Uploads tab.</p>
                    </div>
                  ) : (
                    <SubmissionTable
                      submissions={historicalSubmissions}
                      selectedSubmissionId={selectedSubmissionId}
                      selectedArtifactDetail={selectedSubmissionDetail}
                      detailIsLoading={selectedArtifact?.type === "submission" && artifactDetailQuery.isLoading}
                      detailErrorMessage={selectedArtifact?.type === "submission" ? artifactDetailQuery.error?.message ?? null : null}
                      revealErrorMessage={revealIdentityMutation.error?.message ?? null}
                      isRevealPending={revealIdentityMutation.isPending}
                      revealedIdentity={revealedIdentity}
                      onHideIdentity={() => {
                        setRevealedIdentity(null);
                        revealIdentityMutation.reset();
                      }}
                      onRevealIdentity={(id) => revealIdentityMutation.mutate(id)}
                      onToggleSelect={(id) => toggleSelectedArtifact({ type: "submission", id })}
                      onDownload={(id) => downloadMutation.mutate({ type: "submission", id })}
                    />
                  )}
                </SectionBox>

                {/* Template versions */}
                <SectionBox
                  title="Template Versions"
                  badge={templateVersions.length}
                  badgeVariant={templateVersions.length === 0 ? "warn" : "default"}
                >
                  {templateVersions.length === 0 ? (
                    <div className="empty-state" style={{ padding: "1.5rem" }}>
                      <p style={{ fontSize: "0.875rem" }}>No template uploaded yet. Upload starter code in the Uploads tab.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                      {templateVersions.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.75rem 1rem",
                            borderBottom: "1px solid var(--border-subtle)",
                            background: selectedArtifactKey === `template:${t.id}` ? "var(--brand-soft)" : undefined,
                          }}
                        >
                          <div style={{ display: "flex", flex: 1, alignItems: "center", gap: "0.75rem" }}>
                            <FileCode size={15} color="var(--text-tertiary)" />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                                Version {t.versionNumber}
                                {t.isActive && (
                                  <span className="status-badge badge-ready" style={{ marginLeft: "0.5rem", fontSize: "0.65rem" }}>Active</span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                                {t.fileCount} files &middot; {formatDateTime(t.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              className="btn btn-outline btn-sm"
                              aria-label={selectedArtifactKey === `template:${t.id}` ? "Close template" : "View template"}
                              title={selectedArtifactKey === `template:${t.id}` ? "Close" : "View"}
                              onClick={() => toggleSelectedArtifact({ type: "template", id: t.id })}
                            >
                              {selectedArtifactKey === `template:${t.id}` ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={downloadMutation.isPending}
                              onClick={() => downloadMutation.mutate({ type: "template", id: t.id })}
                            >
                              <Download size={13} />
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={isDangerPending || hasActiveJobs}
                              onClick={() => setConfirmDeleteTemplate({ id: t.id, version: t.versionNumber })}
                              style={{ color: "var(--accent-red)", borderColor: "var(--accent-red)" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionBox>

                {/* Template viewer */}
                {selectedArtifact?.type === "template" && (
                  <SectionBox
                    title={
                      selectedTemplateDetail
                        ? `Template v${selectedTemplateDetail.versionNumber ?? 1} - ${selectedTemplateDetail.displayName}`
                        : "Artifact Viewer"
                    }
                    action={
                      selectedTemplateDetail ? (
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate({ type: "template", id: selectedTemplateDetail.id })}
                        >
                          <Download size={13} /> Download
                        </button>
                      ) : undefined
                    }
                  >
                    <ArtifactDetailBody
                      artifact={selectedTemplateDetail}
                      isLoading={artifactDetailQuery.isLoading}
                      errorMessage={artifactDetailQuery.error?.message ?? null}
                      isRevealPending={revealIdentityMutation.isPending}
                      onHideIdentity={() => {
                        setRevealedIdentity(null);
                        revealIdentityMutation.reset();
                      }}
                      onRevealIdentity={null}
                      revealErrorMessage={revealIdentityMutation.error?.message ?? null}
                      revealedIdentity={revealedIdentity}
                    />
                  </SectionBox>
                )}
              </div>
            )}

            {/* ── PAIRS TAB ── */}
            {activeTab === "pairs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Run status */}
                <div className="glass-card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1rem", marginBottom: "0.2rem" }}>Comparison Results</h2>
                      {latestRun || comparisonStatus ? (
                        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          <span className={`status-badge ${getBadgeClass(comparisonStatus)}`}>
                            {formatComparisonStatusLabel(comparisonStatus)}
                          </span>
                          <span>{getComparisonStatusDescription(comparisonStatus)}</span>
                        </div>
                      ) : (
                        <p style={{ fontSize: "0.82rem", color: "var(--text-tertiary)" }}>No runs yet.</p>
                      )}
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={!canRunComparison}
                      onClick={() => rerunMutation.mutate()}
                    >
                      {rerunMutation.isPending ? <Loader2 size={14} className="anim-spin" /> : <Play size={14} fill="currentColor" />}
                      {rerunMutation.isPending ? "Queueing..." : "Run Comparison"}
                    </button>
                  </div>
                </div>

                {comparisonStatus === "stale" && (
                  <div className="alert" style={{ fontSize: "0.85rem" }}>
                    Results are out of date because assignment inputs changed after the last completed run.
                  </div>
                )}

                {comparisonStatus === "failed" && (
                  <div className="alert alert-error" style={{ fontSize: "0.85rem" }}>
                    The latest comparison attempt failed. Run comparisons again when you are ready.
                  </div>
                )}

                {/* Category switcher */}
                <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
                  {(["current-current", "current-historical"] as const).map((cat) => (
                    <button
                      key={cat}
                      className={`btn ${activePairCategory === cat ? "btn-primary" : "btn-outline"} btn-sm`}
                      onClick={() => setActivePairCategory(cat)}
                    >
                      {cat === "current-current" ? "Current vs Current" : "Current vs Historical"}
                    </button>
                  ))}
                </div>

                {latestVisibleRun ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)" }}>
                        Showing {sectionedPairs.shownCount} of {sectionedPairs.totalCount} pairs
                      </p>
                      {sectionedPairs.hiddenPairs.length > 0 && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setShowAllPairs((v) => !v)}
                        >
                          {showAllPairs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {showAllPairs ? "Hide lower-priority" : "Show all pairs"}
                        </button>
                      )}
                    </div>

                    {visiblePairs.length === 0 ? (
                      <div className="empty-state">
                        <p style={{ fontSize: "0.875rem" }}>
                          No {activePairCategory === "current-current" ? "current vs current" : "current vs historical"} pairs in this run.
                        </p>
                      </div>
                    ) : (
                      <>
                        {sectionedPairs.codeSuspicious.length > 0 && (
                          <PairSection
                            assignmentId={assignment.id}
                            title="Suspicious by Code"
                            description={`Code similarity ≥ ${formatSimilarityPercent(CODE_SUSPICIOUS_THRESHOLD)}`}
                            pairs={sectionedPairs.codeSuspicious}
                          />
                        )}
                        {sectionedPairs.commentSupportedLowCode.length > 0 && (
                          <PairSection
                            assignmentId={assignment.id}
                            title="Comment-Supported"
                            description="Low code similarity but with meaningful comment matches"
                            pairs={sectionedPairs.commentSupportedLowCode}
                          />
                        )}
                        {showAllPairs && sectionedPairs.hiddenPairs.length > 0 && (
                          <PairSection
                            assignmentId={assignment.id}
                            title="Remaining Pairs"
                            description="All remaining pairs"
                            pairs={sectionedPairs.hiddenPairs}
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Database className="empty-state-icon" size={40} />
                    <h3 style={{ fontSize: "1rem", marginBottom: "0.35rem" }}>
                      {comparisonStatus === "running" ? "Comparison In Progress" : "No Current Comparison Results"}
                    </h3>
                    <p style={{ fontSize: "0.875rem" }}>{getComparisonEmptyStateMessage(comparisonStatus)}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── UPLOADS TAB ── */}
            {activeTab === "uploads" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Upload status tracker */}
                {latestUpload && (
                  <div className="glass-card" style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h3 style={{ fontSize: "0.95rem", margin: 0 }}>{formatUploadPurpose(latestUpload.purpose)}</h3>
                      <span className={`status-badge ${getBadgeClass(latestUpload.status)}`}>
                        {latestUpload.status}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {getUploadSummary(
                        latestUpload.status,
                        latestUpload.errorMessage,
                        latestUpload.warningMessage,
                      )}
                    </p>
                    {latestUpload.errorMessage && (
                      <div className="alert alert-error" style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
                        {latestUpload.errorMessage}
                      </div>
                    )}
                    {!latestUpload.errorMessage && latestUpload.warningMessage && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "var(--radius-md)",
                          background: "var(--accent-yellow-soft)",
                          border: "1px solid rgba(217,119,6,0.2)",
                          color: "#92400e",
                          fontSize: "0.82rem",
                        }}
                      >
                        {latestUpload.warningMessage}
                      </div>
                    )}
                  </div>
                )}

                {/* Upload forms side-by-side */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

                  {/* Historical upload */}
                  <div className="glass-card" style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>Historical Submissions</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                      Upload one parent archive. First-layer child zip files become historical submissions.
                    </p>
                    <form
                      onSubmit={(e) => { e.preventDefault(); if (historicalFile && session) historicalUploadMutation.mutate(); }}
                      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                    >
                      <div className="form-group">
                        <label className="form-label">Zip Archive</label>
                        <input
                          className="form-input"
                          type="file"
                          accept=".zip"
                          onChange={(e) => setHistoricalFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      {historicalFile && (
                        <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
                          <FileArchive size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                          {historicalFile.name}
                        </p>
                      )}
                      <button
                        className="btn btn-primary"
                        disabled={!historicalFile || historicalUploadMutation.isPending}
                        type="submit"
                        style={{ width: "100%" }}
                      >
                        {historicalUploadMutation.isPending ? (
                          <><Loader2 size={14} className="anim-spin" /> Uploading...</>
                        ) : (
                          <><Upload size={14} /> Upload Historical</>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Template upload */}
                  <div className="glass-card" style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>Template Code</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                      Upload starter or provided code. Template files stay separate from pair review.
                    </p>
                    <form
                      onSubmit={(e) => { e.preventDefault(); if (templateFile && session) templateUploadMutation.mutate(); }}
                      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                    >
                      <div className="form-group">
                        <label className="form-label">Zip Archive</label>
                        <input
                          className="form-input"
                          type="file"
                          accept=".zip"
                          onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      {templateFile && (
                        <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
                          <FileArchive size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                          {templateFile.name}
                        </p>
                      )}
                      <button
                        className="btn btn-primary"
                        disabled={!templateFile || templateUploadMutation.isPending}
                        type="submit"
                        style={{ width: "100%" }}
                      >
                        {templateUploadMutation.isPending ? (
                          <><Loader2 size={14} className="anim-spin" /> Uploading...</>
                        ) : (
                          <><Upload size={14} /> Upload Template</>
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Due date editor */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Due Date</h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                    {assignment.dueDate ? `Currently: ${formatDateTime(assignment.dueDate)}` : "No due date set."}
                  </p>
                  {isEditingDueDate ? (
                    <form
                      onSubmit={(e: FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        if (dueDateFeedback) return;
                        const next = dueDateInput.trim() ? new Date(dueDateInput) : null;
                        updateDueDateMutation.mutate(next ? next.toISOString() : null);
                      }}
                      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                    >
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={dueDateInput}
                        onChange={(e) => setDueDateInput(e.target.value)}
                      />
                      {dueDateFeedback && (
                        <span style={{ fontSize: "0.78rem", color: "var(--accent-red)" }}>
                          {dueDateFeedback}
                        </span>
                      )}
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={updateDueDateMutation.isPending || Boolean(dueDateFeedback)}
                          type="submit"
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={updateDueDateMutation.isPending}
                          type="button"
                          onClick={() => setIsEditingDueDate(false)}
                        >
                          Cancel
                        </button>
                        {assignment.dueDate && (
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={updateDueDateMutation.isPending}
                            type="button"
                            onClick={() => updateDueDateMutation.mutate(null)}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </form>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsEditingDueDate(true)}
                    >
                      <Clock size={13} /> {assignment.dueDate ? "Edit Due Date" : "Set Due Date"}
                    </button>
                  )}
                </div>

                {/* Upload history */}
                {assignment.uploadBatches.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: "0.9rem", marginBottom: "0.65rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      Upload History
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {assignment.uploadBatches.map((batch) => (
                        <div
                          key={batch.id}
                          className="glass-card"
                          style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{formatUploadPurpose(batch.purpose)}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
                              {formatDateTime(batch.createdAt)}
                            </div>
                            {batch.errorMessage && (
                              <div style={{ fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.2rem" }}>
                                {batch.errorMessage.slice(0, 80)}{batch.errorMessage.length > 80 ? "..." : ""}
                              </div>
                            )}
                            {!batch.errorMessage && batch.warningMessage && (
                              <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.2rem" }}>
                                {batch.warningMessage.slice(0, 100)}{batch.warningMessage.length > 100 ? "..." : ""}
                              </div>
                            )}
                          </div>
                          <span className={`status-badge ${getBadgeClass(batch.status)}`}>
                            {batch.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DANGER ZONE TAB ── */}
            {activeTab === "danger" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div
                  style={{
                    padding: "1rem",
                    background: "var(--accent-red-soft)",
                    border: "1px solid rgba(220,38,38,0.2)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                    color: "#991b1b",
                  }}
                >
                  <strong>Warning:</strong> Actions in this zone are irreversible. Deleting submissions or
                  categories will also clear all comparison results for this assignment.
                </div>

                {hasActiveJobs && (
                  <div className="alert alert-info">
                    Destructive actions are disabled while uploads or comparison runs are active.
                  </div>
                )}

                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem" }}>Delete a Submission</h3>
                  <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "0.85rem" }}>
                    Enter the exact submission name (ID). This flow will not show a
                    browseable submission list, and deletion is only enabled after a valid match is found.
                  </p>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleValidateDeleteSubmission();
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                  >
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                      <input
                        className="form-input"
                        value={deleteSubmissionInput}
                        onChange={(event) => {
                          setDeleteSubmissionInput(event.target.value);
                          setDeleteSubmissionLookup({
                            status: "idle",
                            message:
                              "Enter the exact submission name or unique submission ID, then validate it here before deleting.",
                          });
                        }}
                        placeholder="Enter submission name"
                        disabled={isDangerPending || hasActiveJobs}
                        style={{ flex: "1 1 20rem", minWidth: 220 }}
                      />
                      <button
                        className="btn btn-outline btn-sm"
                        type="submit"
                        disabled={isDangerPending || hasActiveJobs}
                      >
                        Validate Match
                      </button>
                    </div>

                    <div
                      style={{
                        borderRadius: "var(--radius-md)",
                        border:
                          deleteSubmissionLookup.status === "error"
                            ? "1px solid rgba(220,38,38,0.24)"
                            : deleteSubmissionLookup.status === "valid"
                              ? "1px solid rgba(34,197,94,0.24)"
                              : "1px solid var(--border-subtle)",
                        background:
                          deleteSubmissionLookup.status === "error"
                            ? "var(--accent-red-soft)"
                            : deleteSubmissionLookup.status === "valid"
                              ? "rgba(34,197,94,0.08)"
                              : "var(--bg-surface-raised)",
                        color:
                          deleteSubmissionLookup.status === "error"
                            ? "#991b1b"
                            : deleteSubmissionLookup.status === "valid"
                              ? "#166534"
                              : "var(--text-secondary)",
                        fontSize: "0.82rem",
                        padding: "0.7rem 0.8rem",
                      }}
                    >
                      {deleteSubmissionLookup.message}
                    </div>

                    {deleteSubmissionLookup.status === "valid" && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.8rem",
                          alignItems: "flex-start",
                        }}
                      >
                        <SubmissionDeletePreview submission={deleteSubmissionLookup.match} />
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          disabled={isDangerPending || hasActiveJobs}
                          onClick={() => setConfirmDeleteSubmission(deleteSubmissionLookup.match)}
                        >
                          {deleteSubmissionMutation.isPending ? (
                            <Loader2 size={13} className="anim-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          {deleteSubmissionMutation.isPending ? "Deleting..." : "Delete Matched Submission"}
                        </button>
                      </div>
                    )}
                  </form>
                </div>

                {/* Category deletes */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>Delete Category</h3>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={isDangerPending || hasActiveJobs || currentSubmissions.length === 0}
                      onClick={() => setConfirmDeleteCategory({ cat: "current", count: currentSubmissions.length })}
                      style={{ color: "var(--accent-red)", borderColor: "var(--accent-red)" }}
                    >
                      <Trash2 size={13} /> Delete All Current ({currentSubmissions.length})
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={isDangerPending || hasActiveJobs || historicalSubmissions.length === 0}
                      onClick={() => setConfirmDeleteCategory({ cat: "historical", count: historicalSubmissions.length })}
                      style={{ color: "var(--accent-red)", borderColor: "var(--accent-red)" }}
                    >
                      <Trash2 size={13} /> Delete All Historical ({historicalSubmissions.length})
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={isDangerPending || hasActiveJobs || templateVersions.length === 0}
                      onClick={() => setConfirmDeleteCategory({ cat: "template", count: templateVersions.length })}
                      style={{ color: "var(--accent-red)", borderColor: "var(--accent-red)" }}
                    >
                      <Trash2 size={13} /> Delete All Templates ({templateVersions.length})
                    </button>
                  </div>
                </div>

                {/* Delete assignment */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem" }}>Delete Entire Assignment</h3>
                  <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "0.85rem" }}>
                    Permanently removes this assignment and all related uploads, artifacts, and comparison data.
                  </p>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isDangerPending || hasActiveJobs}
                    onClick={() => setConfirmDeleteAssignment(true)}
                  >
                    {deleteAssignmentMutation.isPending ? <Loader2 size={13} className="anim-spin" /> : <Trash2 size={13} />}
                    {deleteAssignmentMutation.isPending ? "Deleting..." : "Delete Assignment"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──

function SectionBox({
  title,
  badge,
  badgeVariant = "default",
  action,
  children,
}: {
  title: string;
  badge?: number;
  badgeVariant?: "default" | "warn";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.85rem 1rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-raised)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>{title}</h3>
          {badge !== undefined && (
            <span
              style={{
                fontSize: "0.7rem",
                background: badgeVariant === "warn" && badge === 0 ? "var(--accent-yellow-soft)" : "var(--bg-surface-highest)",
                color: badgeVariant === "warn" && badge === 0 ? "var(--accent-yellow)" : "var(--text-secondary)",
                borderRadius: "var(--radius-full)",
                padding: "0.1rem 0.45rem",
                fontWeight: 700,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SubmissionDeletePreview({ submission }: { submission: SubmissionDeleteTarget }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        border: "1px solid rgba(220,38,38,0.2)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-surface-raised)",
        padding: "0.85rem 0.95rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{submission.displayName}</div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-tertiary)", marginTop: "0.2rem" }}>
            {capitalizeLabel(submission.kind)} submission
          </div>
        </div>
        <span
          className="status-badge"
          style={{
            background:
              submission.kind === "current" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.14)",
            color: submission.kind === "current" ? "#1d4ed8" : "#b45309",
          }}
        >
          {submission.kind}
        </span>
      </div>
      <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.35rem", fontSize: "0.78rem" }}>
        <div><strong>ID:</strong> <span className="mono">{submission.id}</span></div>
        <div><strong>Files:</strong> {submission.fileCount}</div>
        <div><strong>Uploaded:</strong> {formatDateTime(submission.createdAt)}</div>
      </div>
    </div>
  );
}

function ArtifactDetailBody({
  artifact,
  isLoading,
  errorMessage,
  isRevealPending,
  onHideIdentity,
  onRevealIdentity,
  revealErrorMessage,
  revealedIdentity,
}: {
  artifact: AssignmentArtifactDetail | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  isRevealPending: boolean;
  onHideIdentity: () => void;
  onRevealIdentity: (() => void) | null;
  revealErrorMessage: string | null;
  revealedIdentity: SubmissionIdentityRevealResponse | null;
}) {
  if (isLoading) {
    return (
      <div
        style={{
          padding: "1.5rem",
          textAlign: "center",
          color: "var(--text-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.6rem",
        }}
      >
        <Loader2 size={16} className="anim-spin" /> Loading...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="alert alert-error" style={{ margin: "1rem" }}>
        {errorMessage}
      </div>
    );
  }

  if (!artifact) {
    return null;
  }

  return (
    <div style={{ padding: "1rem" }}>
      {artifact.kind !== "template" && (
        <div style={{ marginBottom: "1rem" }}>
          <SubmissionIdentityPanel
            identityRevealMode={artifact.identityRevealMode}
            isRevealPending={isRevealPending}
            onHide={onHideIdentity}
            onReveal={artifact.identityRevealMode ? onRevealIdentity : null}
            revealError={revealErrorMessage}
            revealedIdentity={revealedIdentity}
          />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {artifact.files.map((file) => {
          const isJunk = isLikelyJunkFile(file.relativePath, file.archivePath);
          return (
            <div
              key={file.id}
              style={{
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid rgba(15,23,42,0.1)",
                opacity: isJunk ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  background: "rgba(15,23,42,0.96)",
                  padding: "0.6rem 1rem",
                  borderBottom: "1px solid rgba(148,163,184,0.16)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#e2e8f0", fontSize: "0.82rem", fontFamily: "var(--font-mono)" }}>
                  {file.relativePath}
                </span>
                {isJunk && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "rgba(203,213,225,0.6)",
                      background: "rgba(255,255,255,0.08)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    system file
                  </span>
                )}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "1rem",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.6,
                  overflow: "auto",
                  maxHeight: 400,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {file.contents}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionTable({
  submissions,
  selectedSubmissionId,
  selectedArtifactDetail,
  detailIsLoading,
  detailErrorMessage,
  isRevealPending,
  onHideIdentity,
  onRevealIdentity,
  revealErrorMessage,
  revealedIdentity,
  onToggleSelect,
  onDownload,
}: {
  submissions: Array<{ id: string; displayName: string; fileCount: number; createdAt: string; kind: string }>;
  selectedSubmissionId: string | null;
  selectedArtifactDetail: AssignmentArtifactDetail | undefined;
  detailIsLoading: boolean;
  detailErrorMessage: string | null;
  isRevealPending: boolean;
  onHideIdentity: () => void;
  onRevealIdentity: (id: string) => void;
  revealErrorMessage: string | null;
  revealedIdentity: SubmissionIdentityRevealResponse | null;
  onToggleSelect: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Files</th>
            <th>Uploaded</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => {
            const isSelected = selectedSubmissionId === s.id;

            return (
              <Fragment key={s.id}>
                <tr style={{ background: isSelected ? "var(--brand-soft)" : undefined }}>
                  <td style={{ fontWeight: 600, fontSize: "0.875rem" }}>{s.displayName}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{s.fileCount}</td>
                  <td style={{ fontSize: "0.8rem" }}>{formatDateTime(s.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                      <button
                        className="btn btn-outline btn-sm"
                        aria-label={isSelected ? "Close submission" : "View submission"}
                        onClick={() => onToggleSelect(s.id)}
                        title={isSelected ? "Close" : "View"}
                      >
                        {isSelected ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => onDownload(s.id)} title="Download">
                        <Download size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {isSelected && (
                  <tr style={{ background: "var(--brand-soft)" }}>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <div style={{ padding: "0 1rem 1rem" }}>
                        <div
                          style={{
                            borderTop: "1px solid var(--border-subtle)",
                            paddingTop: "0.9rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.75rem",
                              padding: "0 0 0.75rem",
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                              {selectedArtifactDetail
                                ? `${capitalizeLabel(selectedArtifactDetail.kind)} - ${selectedArtifactDetail.displayName}`
                                : `${capitalizeLabel(s.kind)} - ${s.displayName}`}
                            </div>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => onDownload(s.id)}
                            >
                              <Download size={13} /> Download
                            </button>
                          </div>
                          <ArtifactDetailBody
                            artifact={selectedArtifactDetail}
                            isLoading={detailIsLoading}
                            errorMessage={detailErrorMessage}
                            isRevealPending={isRevealPending}
                            onHideIdentity={onHideIdentity}
                            onRevealIdentity={() => onRevealIdentity(s.id)}
                            revealErrorMessage={revealErrorMessage}
                            revealedIdentity={revealedIdentity}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function resolveSubmissionDeleteLookup(
  submissions: AssignmentSubmissionListItem[],
  rawInput: string,
): SubmissionDeleteLookupState {
  const query = rawInput.trim();

  if (!query) {
    return {
      status: "error",
      message: "Enter a valid submission ID or exact submission name.",
    };
  }

  const idMatch = submissions.find((submission) => submission.id === query);
  if (idMatch) {
    return {
      status: "valid",
      message: "Matched one submission by unique ID. Review it carefully before deleting.",
      match: toSubmissionDeleteTarget(idMatch),
    };
  }

  const nameMatches = submissions.filter((submission) => submission.displayName === query);
  if (nameMatches.length === 0) {
    return {
      status: "error",
      message: "No such submission.",
    };
  }

  if (nameMatches.length > 1) {
    return {
      status: "error",
      message: "That name matches multiple submissions. Enter the unique submission ID instead.",
    };
  }

  return {
    status: "valid",
    message: "Matched one submission by exact name. Review it carefully before deleting.",
    match: toSubmissionDeleteTarget(nameMatches[0]!),
  };
}

function toSubmissionDeleteTarget(submission: AssignmentSubmissionListItem): SubmissionDeleteTarget {
  return {
    id: submission.id,
    displayName: submission.displayName,
    kind: submission.kind,
    createdAt: submission.createdAt,
    fileCount: submission.fileCount,
  };
}

function PairSection({
  assignmentId,
  title,
  description,
  pairs,
}: {
  assignmentId: string;
  title: string;
  description: string;
  pairs: SuspiciousPairListItem[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{title}</h3>
          <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>{description}</p>
        </div>
        <span
          style={{
            fontSize: "0.7rem",
            background: "var(--bg-surface-highest)",
            padding: "0.1rem 0.45rem",
            borderRadius: "var(--radius-full)",
            fontWeight: 700,
            color: "var(--text-secondary)",
          }}
        >
          {pairs.length}
        </span>
      </div>

      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Left</th>
                <th>Right</th>
                <th>Code Sim</th>
                <th>Comments</th>
                <th>Matches</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => (
                <tr key={pair.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{pair.leftSubmission.displayName}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{capitalizeLabel(pair.leftSubmission.kind)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{pair.rightSubmission.displayName}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{capitalizeLabel(pair.rightSubmission.kind)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: pair.similarityScore >= CODE_SUSPICIOUS_THRESHOLD ? "var(--accent-red)" : "var(--text-primary)" }}>
                      {formatSimilarityPercent(pair.similarityScore)}
                    </div>
                    <div className="score-bar-wrap" style={{ width: 64, marginTop: "0.25rem" }}>
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${Math.round(pair.similarityScore * 100)}%`,
                          background: pair.similarityScore >= CODE_SUSPICIOUS_THRESHOLD ? "var(--accent-red)" : "var(--brand)",
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>{pair.commentMatchCount}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>{pair.matchCount}</td>
                  <td>
                    <Link
                      href={`/professor/assignments/${assignmentId}/pairs/${pair.id}`}
                      className="btn btn-outline btn-sm"
                      style={{ textDecoration: "none" }}
                    >
                      <Eye size={13} /> Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function getBadgeClass(status?: string | null) {
  const s = status?.toLowerCase() ?? "";
  if (!s) return "";
  if (s === "ready" || s === "completed" || s === "current") return "badge-ready";
  if (s === "stale") return "badge-stale";
  if (s === "not_ready") return "badge-not-ready";
  if (s === "failed") return "badge-failed";
  if (s === "running" || s === "preparing" || s === "processing" || s === "queued" || s === "received") return "badge-running";
  return "";
}

function formatComparisonStatusLabel(status: string) {
  if (status === "not_ready") return "not ready";
  if (status === "ready") return "ready to run";
  return status.replace(/_/g, " ");
}

function getComparisonStatusDescription(status: string) {
  if (status === "preparing") return "Uploads are still being prepared.";
  if (status === "running") return "A comparison job is in progress.";
  if (status === "current") return "Current results match the latest prepared inputs.";
  if (status === "stale") return "Displayed results are from older inputs.";
  if (status === "failed") return "The latest comparison attempt failed.";
  if (status === "ready") return "Prepared inputs are ready for a manual run.";
  if (status === "not_ready") return "More prepared submissions are needed before running.";
  return "Status updated.";
}

function getComparisonEmptyStateMessage(status: string) {
  if (status === "preparing") return "Wait for uploads to finish preparing before running comparisons.";
  if (status === "running") return "The worker is processing this comparison right now.";
  if (status === "failed") return "No current results are available because the latest run failed.";
  if (status === "not_ready") return "At least one current submission and two non-template submissions are required.";
  return "Run a comparison to see suspicious pairs.";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toDateTimeLocalInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatUploadPurpose(purpose: string) {
  if (purpose === "historical_submission") return "Historical Submissions";
  if (purpose === "template_upload") return "Template Code";
  return capitalizeLabel(purpose.replace(/[_-]+/g, " "));
}

function getUploadSummary(
  status: string,
  errorMessage: string | null,
  warningMessage: string | null,
) {
  if (errorMessage) return errorMessage.trim().slice(0, 120);
  if (warningMessage) return "This upload finished with warnings.";
  const s = status.toLowerCase();
  if (s === "ready" || s === "completed") return "This upload finished successfully.";
  if (s === "failed") return "This upload did not finish successfully.";
  if (s === "queued") return "Waiting to be processed.";
  if (s === "processing" || s === "running") return "Still being processed.";
  return "Status updated.";
}

function formatSimilarityPercent(value: number | null) {
  if (value === null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function capitalizeLabel(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLikelyJunkFile(relativePath: string, archivePath?: string) {
  const c = `${relativePath} ${archivePath ?? ""}`;
  return /(^|[\\/])__macosx([\\/]|$)|(^|[\\/])\._|(^|[\\/])\.ds_store$|thumbs\.db$/i.test(c);
}

type SuspiciousPairListItem = {
  id: string;
  similarityScore: number;
  commentMatchCount: number;
  matchedTokenCount: number;
  matchCount: number;
  leftSubmission: { id: string; displayName: string; kind: "current" | "historical" };
  rightSubmission: { id: string; displayName: string; kind: "current" | "historical" };
};

function partitionSuspiciousPairs(pairs: SuspiciousPairListItem[]) {
  const indexed = pairs.map((pair, index) => ({ pair, index }));
  const codeSuspicious = indexed
    .filter(({ pair }) => pair.similarityScore >= CODE_SUSPICIOUS_THRESHOLD)
    .sort((a, b) => b.pair.similarityScore - a.pair.similarityScore)
    .map(({ pair }) => pair);
  const commentSupportedLowCode = indexed
    .filter(({ pair }) => pair.similarityScore < CODE_SUSPICIOUS_THRESHOLD && pair.commentMatchCount >= 1)
    .sort((a, b) => b.pair.commentMatchCount - a.pair.commentMatchCount)
    .map(({ pair }) => pair);
  const hiddenPairs = indexed
    .filter(({ pair }) => pair.similarityScore < CODE_SUSPICIOUS_THRESHOLD && pair.commentMatchCount < 1)
    .map(({ pair }) => pair);

  return {
    codeSuspicious,
    commentSupportedLowCode,
    hiddenPairs,
    shownCount: codeSuspicious.length + commentSupportedLowCode.length,
    totalCount: pairs.length,
  };
}
