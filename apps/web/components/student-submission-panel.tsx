"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { getUploadBatch, uploadStudentArchive } from "../lib/api";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";

export function StudentSubmissionPanel() {
  const [assignmentKey, setAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUploadBatchId, setLastUploadBatchId] = useState<string | null>(null);
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const session = currentUserQuery.data ?? null;

  const uploadMutation = useMutation({
    mutationFn: () =>
      uploadStudentArchive({
        assignmentKey,
        file: selectedFile!,
      }),
    onSuccess: (result) => {
      setLastUploadBatchId(result.uploadBatchId);
      setSelectedFile(null);
    },
  });

  const uploadStatusQuery = useQuery({
    queryKey: ["upload-batch", lastUploadBatchId],
    queryFn: () => getUploadBatch(lastUploadBatchId!),
    enabled: Boolean(lastUploadBatchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : 3000;
    },
  });

  const uploadSummary = useMemo(() => uploadStatusQuery.data, [uploadStatusQuery.data]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !session) {
      return;
    }
    uploadMutation.mutate();
  };

  if (!session) {
    return <p className="panel">Sign in as a student to submit a zip archive.</p>;
  }

  if (session.role !== "student") {
    return <p className="panel">This account is not a student account.</p>;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Student Submission</p>
          <h1>Submit one zip archive to one assignment keyID</h1>
          <p>
            Upload one zip, enter the assignment keyID, and the worker will prepare and compare
            your submission against the assignment pool.
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
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Assignment keyID</span>
            <input
              value={assignmentKey}
              onChange={(event) => setAssignmentKey(event.target.value)}
              placeholder="Enter your assignment key"
            />
          </label>
          <label className="field">
            <span>Zip archive</span>
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="primary-button"
            disabled={uploadMutation.isPending || !selectedFile}
            type="submit"
          >
            {uploadMutation.isPending ? "Uploading..." : "Submit zip"}
          </button>
          {uploadMutation.error ? <p className="error-text">{uploadMutation.error.message}</p> : null}
        </form>
      </section>

      {uploadSummary ? (
        <section className="panel">
          <p className="eyebrow">Latest Upload</p>
          <h2>Preparation status</h2>
          <p>Status: <strong>{uploadSummary.status}</strong></p>
          {uploadSummary.errorMessage ? (
            <p className="error-text">{uploadSummary.errorMessage}</p>
          ) : null}
          {uploadSummary.submissions.length > 0 ? (
            <ul className="compact-list">
              {uploadSummary.submissions.map((submission) => (
                <li key={submission.id}>
                  {submission.displayName} ({submission.kind})
                </li>
              ))}
            </ul>
          ) : (
            <p>The archive is still being prepared or queued for comparison.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
