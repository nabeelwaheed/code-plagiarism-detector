"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createAssignment, listAssignments, type AssignmentSummary } from "../lib/api";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";

export function ProfessorDashboard() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"java" | "c" | "cpp">("java");
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
          <h1>Assignment hubs, uploads, and suspicious-pair review</h1>
          <p>
            Create single-language assignments, share the generated keyID, upload historical and
            template archives, and review the latest suspicious pairs.
          </p>
        </div>
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
      </section>

      <section className="panel">
        <h2>Create Assignment</h2>
        <form className="form-stack" onSubmit={handleCreateAssignment}>
          <label className="field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Assignment 2"
            />
          </label>
          <label className="field">
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
            </select>
          </label>
          <button className="primary-button" disabled={createAssignmentMutation.isPending} type="submit">
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
            <p className="eyebrow">Assignments</p>
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
                <span className="pill">{assignment.activeKey ?? "No key"}</span>
              </div>
              <p>
                Current submissions: {assignment.submissionCounts.current} | Historical:{" "}
                {assignment.submissionCounts.historical}
              </p>
              <p>
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
