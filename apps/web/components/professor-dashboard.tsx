"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createAssignment, listAssignments, type AssignmentSummary } from "../lib/api";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";

export function ProfessorDashboard({ successMessage }: { successMessage?: string | null }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"java" | "c" | "cpp">("java");
  const [copyFeedback, setCopyFeedback] = useState<{
    assignmentId: string;
    status: "copied" | "failed";
  } | null>(null);
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
      void queryClient.invalidateQueries({ queryKey: ["assignments", session?.userId] });
    },
  });

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
        setCopyFeedback({
          assignmentId,
          status: "failed",
        });
        window.setTimeout(() => {
          setCopyFeedback((current) => (current?.assignmentId === assignmentId ? null : current));
        }, 1500);
        return;
      }
    }

    setCopyFeedback({
      assignmentId,
      status: "copied",
    });
    window.setTimeout(() => {
      setCopyFeedback((current) => (current?.assignmentId === assignmentId ? null : current));
    }, 1500);
  };

  if (!session) {
    return <p className="panel">Sign in as a professor to manage assignments.</p>;
  }

  if (session.role !== "professor") {
    return (
      <div className="panel">
        <p>This account is not a professor account.</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Professor Workspace</p>
          <h1>Assignment hubs and pair review</h1>
          <p className="subtle-text">
            Create assignments, share keyIDs, and review uploads and suspicious pairs.
          </p>
        </div>
        <div className="toolbar-row">
          <Link className="secondary-button as-link" href="/professor/settings">
            Account settings
          </Link>
          <button
            className="secondary-button"
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
      </section>

      {successMessage === "assignment-deleted" ? (
        <div className="alert alert-info">
          <p>The assignment was deleted successfully.</p>
        </div>
      ) : null}

      <section className="panel">
        <h2>Create Assignment</h2>
        <form className="form-stack form-compact" onSubmit={handleCreateAssignment}>
          <label className="field">
            <span>
              Assignment Title <span className="required-mark">*</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Assignment 2"
            />
          </label>
          <label className="field">
            <span>
              Language <span className="required-mark">*</span>
            </span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
            </select>
          </label>
          <button
            className="primary-button"
            disabled={createAssignmentMutation.isPending || !title.trim()}
            type="submit"
          >
            {createAssignmentMutation.isPending ? "Creating..." : "Create assignment"}
          </button>
          {createAssignmentMutation.error ? (
            <p className="error-text">{createAssignmentMutation.error.message}</p>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Your active hubs</h2>
          </div>
        </div>

        {assignmentsQuery.isLoading ? <p>Loading assignments...</p> : null}
        {assignmentsQuery.error ? <p className="error-text">{assignmentsQuery.error.message}</p> : null}

        <div className="card-grid">
          {assignmentsQuery.data?.map((assignment: AssignmentSummary) => (
            <article className="assignment-card" key={assignment.id}>
              <div className="assignment-card-top">
                <div>
                  <p className="eyebrow">{assignment.language.toUpperCase()}</p>
                  <h3>{assignment.title}</h3>
                </div>
                <div className="key-actions">
                  <span className="pill">{assignment.activeKey ?? "No key"}</span>
                  <button
                    className="secondary-button key-copy-button"
                    disabled={!assignment.activeKey}
                    onClick={() => void handleCopyKey(assignment.id, assignment.activeKey)}
                    type="button"
                  >
                    {copyFeedback?.assignmentId === assignment.id
                      ? copyFeedback.status === "copied"
                        ? "Copied"
                        : "Copy failed"
                      : "Copy"}
                  </button>
                </div>
              </div>
              <p className="subtle-text">
                Current submissions: {assignment.submissionCounts.current} | Historical:{" "}
                {assignment.submissionCounts.historical}
              </p>
              <p className="subtle-text">
                Latest run:{" "}
                {assignment.latestComparisonRun
                  ? `${assignment.latestComparisonRun.status} (${assignment.latestComparisonRun.pairCount} pairs)`
                  : "none yet"}
              </p>
              <Link className="text-link" href={`/professor/assignments/${assignment.id}`}>
                Open assignment
              </Link>
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
