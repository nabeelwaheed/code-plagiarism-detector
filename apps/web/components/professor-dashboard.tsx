"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Plus, Copy, Search, ArrowRight, BarChart3, FileText, History, AlertTriangle, ChevronRight } from "lucide-react";
import { createAssignment, listAssignments } from "../lib/api";
import {
  formatDateTime,
  formatLanguageLabel,
  formatStatusLabel,
  getRiskLabel,
  getRiskTone,
  getStatusTone,
} from "../lib/view-models";
import { useCurrentUserQuery } from "./auth-hooks";
import { useToast } from "./toast-provider";

type LanguageFilter = "all" | "java" | "c" | "cpp";

export function ProfessorDashboard() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"java" | "c" | "cpp">("java");
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createValidationError, setCreateValidationError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUserQuery();
  const session = currentUserQuery.data ?? null;

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: () => listAssignments(),
    enabled: session?.role === "professor",
    refetchInterval: 5000,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: () => createAssignment({ title, language }),
    onSuccess: () => {
      setTitle("");
      setLanguage("java");
      setCreateValidationError(null);
      setShowCreateForm(false);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      pushToast({ tone: "success", title: "Assignment created", description: "Share the access key with your students." });
    },
  });

  const filteredAssignments = useMemo(() => {
    const all = assignmentsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((a) => {
      const matchLang = languageFilter === "all" || a.language === languageFilter;
      const matchSearch = !q || a.title.toLowerCase().includes(q) || a.activeKey?.toLowerCase().includes(q);
      return matchLang && matchSearch;
    });
  }, [assignmentsQuery.data, languageFilter, search]);

  const stats = useMemo(() => {
    const all = assignmentsQuery.data ?? [];
    return {
      assignments: all.length,
      totalCurrent: all.reduce((s, a) => s + a.submissionCounts.current, 0),
      totalHistorical: all.reduce((s, a) => s + a.submissionCounts.historical, 0),
      totalPairs: all.reduce((s, a) => s + (a.latestComparisonRun?.pairCount ?? 0), 0),
    };
  }, [assignmentsQuery.data]);

  const handleCopyKey = async (assignmentId: string, key: string | null) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      try { copyFallback(key); } catch {
        pushToast({ tone: "error", title: "Copy failed", description: "Select and copy the key manually." });
        return;
      }
    }
    pushToast({ tone: "success", title: "Access key copied" });
  };

  const handleCreateAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setCreateValidationError("Enter an assignment title so students know what they are submitting.");
      return;
    }

    setCreateValidationError(null);
    createAssignmentMutation.mutate();
  };

  if (!session) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" />
          <strong>Checking session</strong>
          <p className="secondary-text">Verifying your credentials.</p>
        </div>
      </div>
    );
  }

  if (session.role !== "professor") {
    return <div className="error-panel"><strong>Instructor access required</strong><p>Sign in with an instructor account to view this page.</p></div>;
  }

  return (
    <div style={{ display: "grid", gap: "2rem" }} className="fade-up">

      {/* ── Page header (no card, just text + action) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">Instructor Dashboard</p>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0.25rem 0 0.4rem" }}>
            Your Assignments
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>
            Manage assignments, review submissions, and analyze code similarity.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          type="button"
          style={{ alignSelf: "flex-start" }}
        >
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.85rem" }}>
        <StatBox icon={<FileText size={15} />} label="Assignments" value={stats.assignments} />
        <StatBox icon={<BarChart3 size={15} />} label="Current Submissions" value={stats.totalCurrent} />
        <StatBox icon={<History size={15} />} label="Historical" value={stats.totalHistorical} />
        <StatBox icon={<AlertTriangle size={15} />} label="Flagged Pairs" value={stats.totalPairs} />
      </div>

      {/* ── Create assignment panel ── */}
      {showCreateForm ? (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem", boxShadow: "var(--shadow-md)",
        }} className="fade-up">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>Create Assignment</h2>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                A unique access key will be generated for students to submit work.
              </p>
            </div>
            <button className="ghost-button button-compact" onClick={() => setShowCreateForm(false)} type="button">
              Cancel
            </button>
          </div>
          <form noValidate onSubmit={handleCreateAssignment}
            style={{ display: "grid", gap: "0.85rem" }}>
            <div className="split-grid">
              <div className="field">
                <label className="field-label">Title <span className="required-mark">*</span></label>
                <input
                  aria-describedby={createValidationError ? "assignment-title-error" : undefined}
                  aria-invalid={Boolean(createValidationError)}
                  className={`input-control${createValidationError ? " is-invalid" : ""}`}
                  value={title}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setTitle(nextValue);
                    if (createValidationError && nextValue.trim()) {
                      setCreateValidationError(null);
                    }
                  }}
                  placeholder="e.g. Assignment 2 — Linked Lists" />
                {createValidationError ? <p className="field-error" id="assignment-title-error">{createValidationError}</p> : null}
              </div>
              <div className="field">
                <label className="field-label">Language <span className="required-mark">*</span></label>
                <select className="select-control" value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
                  <option value="java">Java</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                </select>
              </div>
            </div>
            {createAssignmentMutation.error ? (
              <div className="error-panel"><strong>Could not create assignment</strong><p>{createAssignmentMutation.error.message}</p></div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="primary-button" disabled={createAssignmentMutation.isPending} type="submit">
                <Plus size={15} />
                {createAssignmentMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ── Assignment list ── */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input className="input-control" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or key…" style={{ paddingLeft: 36, width: "100%" }} />
          </div>
          <select className="select-control" value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value as LanguageFilter)} style={{ minWidth: 140 }}>
            <option value="all">All Languages</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>

        {assignmentsQuery.isLoading ? (
          <div className="loading-card"><div className="spinner" /><strong>Loading assignments</strong></div>
        ) : null}

        {assignmentsQuery.error ? (
          <div className="error-panel"><strong>Could not load assignments</strong><p>{assignmentsQuery.error.message}</p></div>
        ) : null}

        {!assignmentsQuery.isLoading && !assignmentsQuery.error && filteredAssignments.length === 0 ? (
          <div className="empty-panel">
            <div className="empty-icon"><FileText size={20} /></div>
            <strong>No Assignments Found</strong>
            <p>{search || languageFilter !== "all" ? "Try adjusting your filters." : "Create your first assignment to get started."}</p>
          </div>
        ) : null}

        <div className="dashboard-card-grid">
          {filteredAssignments.map((assignment) => {
            const riskVal = assignment.latestComparisonRun?.pairCount
              ? Math.min(assignment.latestComparisonRun.pairCount / 10, 1) : 0;
            return (
              <article className="dashboard-assignment-card" key={assignment.id}>
                {/* Title row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {formatLanguageLabel(assignment.language)}
                    </span>
                    <h3 style={{ margin: "0.2rem 0 0", fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.015em" }}>
                      {assignment.title}
                    </h3>
                  </div>
                  <span className={`status-pill tone-${getStatusTone(assignment.latestComparisonRun?.status)}`} style={{ flexShrink: 0 }}>
                    {assignment.latestComparisonRun ? formatStatusLabel(assignment.latestComparisonRun.status) : "Not analyzed"}
                  </span>
                </div>

                {/* Quick stats */}
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <span><strong style={{ color: "var(--text-primary)" }}>{assignment.submissionCounts.current}</strong> current</span>
                  <span><strong style={{ color: "var(--text-primary)" }}>{assignment.submissionCounts.historical}</strong> historical</span>
                  <span><strong style={{ color: "var(--text-primary)" }}>{assignment.latestComparisonRun?.pairCount ?? 0}</strong> flagged</span>
                </div>

                {/* Key row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", background: "var(--surface-inset)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <code className="mono" style={{ flex: 1, fontSize: "0.82rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {assignment.activeKey ?? "No key assigned"}
                  </code>
                  {assignment.activeKey ? (
                    <button className="ghost-button button-compact" type="button"
                      onClick={() => void handleCopyKey(assignment.id, assignment.activeKey)}>
                      <Copy size={13} />
                    </button>
                  ) : null}
                </div>

                {/* Action row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {assignment.latestComparisonRun ? (
                    <span className={`status-pill tone-${getRiskTone(riskVal)}`} style={{ fontSize: "0.75rem" }}>
                      {getRiskLabel(riskVal)}
                    </span>
                  ) : (
                    <span className="helper-text">Run an analysis after uploading.</span>
                  )}
                  <Link className="primary-button as-link button-compact" href={`/professor/assignments/${assignment.id}`}>
                    Open <ChevronRight size={13} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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
      <strong style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text-primary)" }}>
        {value}
      </strong>
    </div>
  );
}

function copyFallback(value: string) {
  const el = document.createElement("textarea");
  el.value = value;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus(); el.select();
  if (!document.execCommand("copy")) throw new Error("copy failed");
  document.body.removeChild(el);
}
