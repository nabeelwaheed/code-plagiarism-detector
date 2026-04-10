"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Key,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { createAssignment, listAssignments, updateAssignmentDueDate, type AssignmentSummary } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { AssignmentModal } from "./assignment-modal";
import { useToast } from "./toast";

type AssignmentFormState = {
  title: string;
  language: "java" | "c" | "cpp";
  dueDate: string;
};

const DEFAULT_FORM: AssignmentFormState = { title: "", language: "java", dueDate: "" };

function getPastDueDateFeedback(dueDate: string) {
  if (!dueDate.trim()) return null;

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.getTime() < Date.now() ? "Please choose a future date and time." : null;
}

function getAvatarColor(email: string) {
  const colors = ["#1d4ed8", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function AssignmentCard({
  assignment,
  onEdit,
}: {
  assignment: AssignmentSummary;
  onEdit: (a: AssignmentSummary) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyKey = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!assignment.activeKey) return;
    try {
      await navigator.clipboard.writeText(assignment.activeKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  };

  const runStatus = assignment.comparisonStatus;
  const runStatusClass =
    runStatus === "current" || runStatus === "ready" ? "badge-completed" :
    runStatus === "stale" ? "badge-stale" :
    runStatus === "not_ready" ? "badge-not-ready" :
    runStatus === "failed"    ? "badge-failed" :
    runStatus === "running" || runStatus === "preparing" || runStatus === "queued" ? "badge-running" : "";

  return (
    <div
      className="glass-card animate-fade-in"
      style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Top row: course tag + language badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            className="status-badge"
            style={{ background: "var(--bg-surface-raised)", color: "var(--text-secondary)" }}
          >
            <BookOpen size={11} /> {assignment.language.toUpperCase()}
          </span>
        </div>
        {runStatus && (
          <span className={`status-badge ${runStatusClass}`}>
            {formatComparisonStatusLabel(runStatus)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{ fontSize: "1.1rem", lineHeight: 1.3, margin: 0 }}>{assignment.title}</h3>

      {/* Key row */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.83rem", color: "var(--text-secondary)" }}>
        {assignment.activeKey && (
          <button
            onClick={handleCopyKey}
            className="copy-btn-inline"
            title="Click to copy access key"
            style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.4rem", borderRadius: "var(--radius-sm)", fontSize: "0.83rem", color: "var(--text-secondary)" }}
          >
            <Key size={13} color="var(--accent-yellow)" />
            <span className="mono" style={{ fontSize: "0.8rem" }}>{assignment.activeKey}</span>
            {copied ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} color="var(--text-tertiary)" />}
            {copied && <span style={{ fontSize: "0.7rem", color: "var(--accent-green)", fontWeight: 600 }}>Copied!</span>}
          </button>
        )}
        {assignment.dueDate && (
          <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
            Due: {formatDateTime(assignment.dueDate)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          paddingTop: "0.85rem",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "-0.03em" }}>
            {assignment.submissionCounts.current}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Current
          </div>
        </div>
        <div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "-0.03em" }}>
            {assignment.submissionCounts.historical}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Historical
          </div>
        </div>
        {assignment.latestComparisonRun && (
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "-0.03em" }}>
              {assignment.latestComparisonRun.pairCount}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Pairs
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <Link
        href={`/professor/assignments/${assignment.id}`}
        className="btn btn-outline"
        style={{ width: "100%", justifyContent: "space-between", background: "var(--bg-surface-raised)", textDecoration: "none" }}
      >
        View Details <ChevronRight size={16} />
      </Link>

      <button
        className="btn btn-outline btn-sm"
        onClick={() => onEdit(assignment)}
        style={{ width: "100%", justifyContent: "center" }}
      >
        Edit Due Date
      </button>
    </div>
  );
}

function formatComparisonStatusLabel(status: AssignmentSummary["comparisonStatus"]) {
  if (status === "not_ready") return "not ready";
  if (status === "ready") return "ready to run";
  return status.replace(/_/g, " ");
}

export function ProfessorDashboard({ successMessage }: { successMessage?: string | null }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUserQuery = useCurrentUserQuery();
  const session = currentUserQuery.data ?? null;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentSummary | null>(null);
  const [formState, setFormState] = useState<AssignmentFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: () => listAssignments(),
    enabled: session?.role === "professor",
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAssignment({
        title: formState.title,
        language: formState.language,
        dueDate: formState.dueDate ? new Date(formState.dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      setIsModalOpen(false);
      setFormState(DEFAULT_FORM);
      setFormError(null);
      setEditingAssignment(null);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      showToast("Assignment created successfully.", "success");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const updateDueDateMutation = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string | null }) =>
      updateAssignmentDueDate(id, dueDate),
    onSuccess: () => {
      setIsModalOpen(false);
      setEditingAssignment(null);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      showToast("Due date updated.", "success");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setFormState(DEFAULT_FORM);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment: AssignmentSummary) => {
    let dueDate = "";
    if (assignment.dueDate) {
      const dt = new Date(assignment.dueDate);
      const pad = (n: number) => n.toString().padStart(2, "0");
      dueDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }
    setEditingAssignment(assignment);
    setFormState({ title: assignment.title, language: assignment.language, dueDate });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!formState.title.trim()) return;
    if (getPastDueDateFeedback(formState.dueDate)) return;

    if (editingAssignment) {
      updateDueDateMutation.mutate({
        id: editingAssignment.id,
        dueDate: formState.dueDate ? new Date(formState.dueDate).toISOString() : null,
      });
    } else {
      createMutation.mutate();
    }
  };

  const assignments = assignmentsQuery.data ?? [];
  const dueDateFeedback = getPastDueDateFeedback(formState.dueDate);

  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.language.toLowerCase().includes(q) ||
        a.activeKey?.toLowerCase().includes(q),
    );
  }, [assignments, searchQuery]);

  const stats = useMemo(() => {
    const totalCurrent = assignments.reduce((s, a) => s + (a.submissionCounts?.current ?? 0), 0);
    const totalHistorical = assignments.reduce((s, a) => s + (a.submissionCounts?.historical ?? 0), 0);
    const totalPairs = assignments.reduce((s, a) => s + (a.latestComparisonRun?.pairCount ?? 0), 0);
    return { count: assignments.length, totalCurrent, totalHistorical, totalPairs };
  }, [assignments]);

  if (!session) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
        Sign in as a professor to manage assignments.
      </div>
    );
  }

  if (session.role !== "professor") {
    return (
      <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
        <p>This account is not a professor account.</p>
      </div>
    );
  }

  const isPending = createMutation.isPending || updateDueDateMutation.isPending;

  return (
    <>
      {/* Modals */}
      <AssignmentModal
        open={isModalOpen}
        formState={formState}
        isEditing={Boolean(editingAssignment)}
        isPending={isPending}
        error={formError}
        dueDateFeedback={dueDateFeedback}
        onChange={(nextState) => {
          setFormState(nextState);
          if (formError) {
            setFormError(null);
          }
        }}
        onSubmit={handleSubmit}
        onClose={() => { setIsModalOpen(false); setFormError(null); }}
      />

      {/* Instructor nav bar */}
      <nav className="instructor-nav">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
          <ShieldCheck size={17} />
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Instructor View</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {session && (
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}
            >
              <div
                className="avatar"
                style={{ background: getAvatarColor(session.email ?? "") }}
              >
                {getInitials(session.email ?? "PR")}
              </div>
              <span>
                Hello, <strong>{session.email?.split("@")[0]}</strong>
              </span>
            </div>
          )}
          <Link href="/professor/settings" className="btn btn-outline btn-sm">
            <Settings size={13} /> Settings
          </Link>
        </div>
      </nav>

      {/* Page content */}
      <main className="page-shell" style={{ paddingTop: "1.25rem" }}>
        {successMessage === "assignment-deleted" && (
          <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
            The assignment was deleted successfully.
          </div>
        )}

        {/* Dashboard header + stats */}
        <div
          className="glass-card"
          style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.4rem", marginBottom: "0.2rem" }}>Instructor Dashboard</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Manage assignments, review uploads, and analyze suspicious pairs.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={17} /> New Assignment
            </button>
          </div>

          {/* Stats tiles */}
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-tile-label">Assignments</div>
              <div className="stat-tile-value">{stats.count}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Current Submissions</div>
              <div className="stat-tile-value">{stats.totalCurrent}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Historical</div>
              <div className="stat-tile-value">{stats.totalHistorical}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Pairs Detected</div>
              <div className="stat-tile-value">{stats.totalPairs}</div>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <div className="input-with-icon" style={{ flex: 1 }}>
              <Search size={15} />
              <input
                className="form-input"
                style={{ height: "2.2rem", fontSize: "0.85rem" }}
                type="text"
                placeholder="Search by title, language, or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSearchQuery("")}
                style={{ whiteSpace: "nowrap" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Assignments grid */}
        {assignmentsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>
            Loading assignments...
          </div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">
            <BookOpen className="empty-state-icon" size={48} />
            <h3 style={{ marginBottom: "0.35rem" }}>No Assignments Yet</h3>
            <p style={{ fontSize: "0.88rem", maxWidth: 300, margin: "0 auto 1rem" }}>
              Click &ldquo;New Assignment&rdquo; to start accepting student code submissions.
            </p>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> Create your first assignment
            </button>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="glass-card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: "0.95rem" }}>No assignments match &ldquo;{searchQuery}&rdquo;</p>
            <button className="btn btn-outline btn-sm" onClick={() => setSearchQuery("")} style={{ marginTop: "0.75rem" }}>
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600, margin: 0 }}>
                Assignments
              </h2>
              <span
                style={{
                  fontSize: "0.72rem",
                  background: "var(--bg-surface-highest)",
                  color: "var(--text-secondary)",
                  borderRadius: "var(--radius-full)",
                  padding: "0.12rem 0.5rem",
                  fontWeight: 700,
                }}
              >
                {filteredAssignments.length}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} onEdit={handleOpenEdit} />
              ))}
            </div>
          </>
        )}

        {assignmentsQuery.error && (
          <div className="alert alert-error" style={{ marginTop: "1rem" }}>
            {assignmentsQuery.error.message}
          </div>
        )}
      </main>
    </>
  );
}
