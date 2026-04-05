"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createAssignment, listAssignments, type AssignmentSummary } from "../lib/api";
import {
  formatDateTime,
  formatLanguageLabel,
  formatStatusLabel,
  formatSimilarityPercent,
  getRiskLabel,
  getRiskTone,
  getStatusTone,
} from "../lib/view-models";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";
import { useToast } from "./toast-provider";

type LanguageFilter = "all" | "java" | "c" | "cpp";

export function ProfessorDashboard() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"java" | "c" | "cpp">("java");
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const session = currentUserQuery.data ?? null;

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: () => listAssignments(),
    enabled: session?.role === "professor",
    refetchInterval: 5000,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: () =>
      createAssignment({
        title,
        language,
      }),
    onSuccess: () => {
      setTitle("");
      setLanguage("java");
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      pushToast({
        tone: "success",
        title: "Assignment created",
        description: "A new assignment hub is ready to manage.",
      });
    },
  });

  const filteredAssignments = useMemo(() => {
    const assignments = assignmentsQuery.data ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesLanguage = languageFilter === "all" || assignment.language === languageFilter;
      const matchesSearch =
        !normalizedSearch
        || assignment.title.toLowerCase().includes(normalizedSearch)
        || assignment.activeKey?.toLowerCase().includes(normalizedSearch);
      return matchesLanguage && matchesSearch;
    });
  }, [assignmentsQuery.data, languageFilter, search]);

  const stats = useMemo(() => {
    const assignments = assignmentsQuery.data ?? [];
    const totalCurrent = assignments.reduce(
      (sum, assignment) => sum + assignment.submissionCounts.current,
      0,
    );
    const totalHistorical = assignments.reduce(
      (sum, assignment) => sum + assignment.submissionCounts.historical,
      0,
    );
    const totalPairs = assignments.reduce(
      (sum, assignment) => sum + (assignment.latestComparisonRun?.pairCount ?? 0),
      0,
    );

    return {
      assignments: assignments.length,
      totalCurrent,
      totalHistorical,
      totalPairs,
    };
  }, [assignmentsQuery.data]);

  const handleCreateAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !session) {
      return;
    }

    createAssignmentMutation.mutate();
  };

  const handleCopyKey = async (assignmentId: string, key: string | null) => {
    if (!key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(key);
    } catch {
      try {
        copyWithDocumentFallback(key);
      } catch {
        pushToast({
          tone: "error",
          title: "Key copy failed",
          description: `The key for assignment ${assignmentId} could not be copied.`,
        });
        return;
      }
    }

    pushToast({
      tone: "success",
      title: "Assignment key copied",
      description: key,
    });
  };

  if (!session) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <strong>Checking session</strong>
          <p className="secondary-text">Sign in as a professor to manage assignments.</p>
        </div>
      </div>
    );
  }

  if (session.role !== "professor") {
    return (
      <div className="page-stack">
        <section className="error-panel">
          <strong>Professor access required</strong>
          <p>This session does not have permission to open the professor dashboard.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="shell-stack fade-up">
      <section className="dashboard-hero">
        <div className="dashboard-hero-grid">
          <div className="card-stack">
            <div className="stack-sm">
              <p className="eyebrow">Professor Dashboard</p>
              <h1 className="page-title">Assignment operations and review overview</h1>
              <p className="secondary-text">
                Track active keyIDs, upload activity, and the latest suspicious-pair results from a
                single workspace.
              </p>
            </div>
            <div className="dashboard-stats">
              <div className="summary-card">
                <span>Assignments</span>
                <strong>{stats.assignments}</strong>
              </div>
              <div className="summary-card">
                <span>Current submissions</span>
                <strong>{stats.totalCurrent}</strong>
              </div>
              <div className="summary-card">
                <span>Historical submissions</span>
                <strong>{stats.totalHistorical}</strong>
              </div>
              <div className="summary-card">
                <span>Latest visible pairs</span>
                <strong>{stats.totalPairs}</strong>
              </div>
            </div>
          </div>

          <div className="card-stack">
            <div className="action-row">
              <Link className="secondary-button as-link" href="/">
                Open public upload
              </Link>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  logoutMutation.mutate(undefined, {
                    onSettled: () => {
                      window.location.href = "/login";
                    },
                  });
                }}
              >
                Sign out
              </button>
            </div>

            <form className="section-card" onSubmit={handleCreateAssignment}>
              <div className="stack-sm">
                <p className="eyebrow">Create Assignment</p>
                <h2 className="section-title">Start a new assignment hub</h2>
              </div>

              <div className="input-grid">
                <label className="field">
                  <span className="field-label">
                    Assignment title <span className="required-mark">*</span>
                  </span>
                  <input
                    className="input-control"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Assignment 2"
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    Language <span className="required-mark">*</span>
                  </span>
                  <select
                    className="select-control"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as typeof language)}
                  >
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                  </select>
                </label>
              </div>

              {createAssignmentMutation.error ? (
                <div className="error-panel">
                  <strong>Could not create assignment</strong>
                  <p>{createAssignmentMutation.error.message}</p>
                </div>
              ) : null}

              <button
                className="primary-button"
                disabled={createAssignmentMutation.isPending || !title.trim()}
                type="submit"
              >
                {createAssignmentMutation.isPending ? "Creating..." : "Create assignment"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div className="stack-xs">
            <p className="eyebrow">Assignments</p>
            <h2 className="section-title">Active assignment hubs</h2>
          </div>
          <div className="toolbar-filters">
            <input
              className="input-control"
              aria-label="Search assignments"
              placeholder="Search title or keyID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="select-control"
              aria-label="Filter assignments by language"
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value as LanguageFilter)}
            >
              <option value="all">All languages</option>
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
            </select>
          </div>
        </div>

        {assignmentsQuery.isLoading ? (
          <div className="loading-card">
            <div className="spinner" aria-hidden="true" />
            <strong>Loading assignments</strong>
            <p className="secondary-text">Refreshing assignment summaries from the server.</p>
          </div>
        ) : null}

        {assignmentsQuery.error ? (
          <div className="error-panel">
            <strong>Assignments could not be loaded</strong>
            <p>{assignmentsQuery.error.message}</p>
          </div>
        ) : null}

        {!assignmentsQuery.isLoading && !assignmentsQuery.error && filteredAssignments.length === 0 ? (
          <div className="empty-panel">
            <div className="empty-icon" aria-hidden="true">
              ?
            </div>
            <strong>No assignments match this view</strong>
            <p>Adjust the filters or create a new assignment hub to get started.</p>
          </div>
        ) : null}

        <div className="dashboard-card-grid">
          {filteredAssignments.map((assignment) => (
            <article className="dashboard-assignment-card" key={assignment.id}>
              <div className="section-heading">
                <div className="row-title">
                  <p className="eyebrow">{formatLanguageLabel(assignment.language)}</p>
                  <h3 className="card-title">{assignment.title}</h3>
                </div>
                <span className={`status-pill tone-${getStatusTone(assignment.latestComparisonRun?.status)}`}>
                  {assignment.latestComparisonRun
                    ? formatStatusLabel(assignment.latestComparisonRun.status)
                    : "No run yet"}
                </span>
              </div>

              <div className="summary-grid">
                <div className="surface-soft">
                  <div className="detail-item">
                    <span>Current</span>
                    <strong>{assignment.submissionCounts.current}</strong>
                  </div>
                </div>
                <div className="surface-soft">
                  <div className="detail-item">
                    <span>Historical</span>
                    <strong>{assignment.submissionCounts.historical}</strong>
                  </div>
                </div>
                <div className="surface-soft">
                  <div className="detail-item">
                    <span>Latest pairs</span>
                    <strong>{assignment.latestComparisonRun?.pairCount ?? 0}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-list">
                <div className="detail-item">
                  <span>Active keyID</span>
                  <div className="toolbar-row">
                    <code className="mono">{assignment.activeKey ?? "No active key"}</code>
                    <button
                      className="secondary-button button-compact"
                      type="button"
                      disabled={!assignment.activeKey}
                      onClick={() => void handleCopyKey(assignment.id, assignment.activeKey)}
                    >
                      Copy key
                    </button>
                  </div>
                </div>
                <div className="detail-item">
                  <span>Latest run</span>
                  <div className="toolbar-row">
                    <span>{assignment.latestComparisonRun ? formatDateTime(assignment.latestComparisonRun.createdAt) : "Not run yet"}</span>
                    {assignment.latestComparisonRun ? (
                      <span className={`status-pill tone-${getRiskTone(assignment.latestComparisonRun.pairCount ? Math.min(assignment.latestComparisonRun.pairCount / 10, 1) : 0)}`}>
                        {getRiskLabel(
                          assignment.latestComparisonRun.pairCount
                            ? Math.min(assignment.latestComparisonRun.pairCount / 10, 1)
                            : 0
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="row-actions">
                <Link className="primary-button as-link" href={`/professor/assignments/${assignment.id}`}>
                  Open assignment
                </Link>
                {assignment.latestComparisonRun ? (
                  <span className="helper-text">
                    {formatSimilarityPercent(assignment.latestComparisonRun.pairCount ? Math.min(assignment.latestComparisonRun.pairCount / 10, 1) : 0)}
                    {" "}review intensity
                  </span>
                ) : (
                  <span className="helper-text">Queue a comparison after uploads are ready.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function copyWithDocumentFallback(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("copy command failed");
  }
}
