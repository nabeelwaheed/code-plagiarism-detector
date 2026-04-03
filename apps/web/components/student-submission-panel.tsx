"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  getPublicUploadBatch,
  getSubmissionIdentityPublicKey,
  uploadPublicStudentArchive,
} from "../lib/api";
import {
  encryptSubmissionIdentity,
  normalizeAssignmentKey,
} from "../lib/submission-identity";

export function StudentSubmissionPanel() {
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [assignmentKey, setAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUploadBatchId, setLastUploadBatchId] = useState<string | null>(null);
  const [lastStatusToken, setLastStatusToken] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const encryptionKey = await getSubmissionIdentityPublicKey();
      const encryptedIdentity = await encryptSubmissionIdentity({
        studentName,
        studentNumber,
        studentEmail,
        assignmentKey,
      }, encryptionKey);

      return uploadPublicStudentArchive({
        assignmentKey: normalizeAssignmentKey(assignmentKey),
        encryptedIdentity,
        file: selectedFile!,
      });
    },
    onSuccess: (result) => {
      setLastUploadBatchId(result.uploadBatchId);
      setLastStatusToken(result.statusToken);
      setSelectedFile(null);
    },
  });

  const uploadStatusQuery = useQuery({
    queryKey: ["public-upload-batch", lastUploadBatchId, lastStatusToken],
    queryFn: () => getPublicUploadBatch(lastUploadBatchId!, lastStatusToken!),
    enabled: Boolean(lastUploadBatchId && lastStatusToken),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : 3000;
    },
  });

  const uploadSummary = useMemo(() => uploadStatusQuery.data, [uploadStatusQuery.data]);
  const isSubmitEnabled =
    Boolean(selectedFile)
    && Boolean(studentName.trim())
    && Boolean(studentNumber.trim())
    && Boolean(assignmentKey.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !studentName.trim() || !studentNumber.trim() || !assignmentKey.trim()) {
      return;
    }

    uploadMutation.mutate();
  };

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Student Submission</p>
          <h1>Submit one zip archive to one assignment keyID</h1>
          <p>
            Enter your student details, provide the assignment keyID, and upload one zip archive.
            The app encrypts your identifying information in your browser before anything is sent
            to the server.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button as-link" href="/login">
            Professor sign in
          </Link>
          <Link className="primary-button as-link" href="/signup">
            Professor sign up
          </Link>
        </div>
      </section>

      <section className="panel">
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>
              Student name <span className="required-mark">*</span>
            </span>
            <input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Jane Student"
            />
          </label>
          <label className="field">
            <span>
              Student number <span className="required-mark">*</span>
            </span>
            <input
              value={studentNumber}
              onChange={(event) => setStudentNumber(event.target.value)}
              placeholder="1234567"
            />
          </label>
          <label className="field">
            <span>Student email</span>
            <input
              value={studentEmail}
              onChange={(event) => setStudentEmail(event.target.value)}
              placeholder="Optional"
              type="email"
            />
          </label>
          <p className="muted-text">
            Optional email is encrypted and submitted only if you provide it.
          </p>
          <label className="field">
            <span>
              Assignment keyID <span className="required-mark">*</span>
            </span>
            <input
              value={assignmentKey}
              onChange={(event) => setAssignmentKey(event.target.value)}
              placeholder="Enter your assignment key"
            />
          </label>
          <label className="field">
            <span>
              Zip archive <span className="required-mark">*</span>
            </span>
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="primary-button"
            disabled={uploadMutation.isPending || !isSubmitEnabled}
            type="submit"
          >
            {uploadMutation.isPending ? "Uploading..." : "Submit zip"}
          </button>
          {uploadMutation.error ? <p className="error-text">{uploadMutation.error.message}</p> : null}
          {uploadStatusQuery.error ? (
            <p className="error-text">{uploadStatusQuery.error.message}</p>
          ) : null}
        </form>
      </section>

      {uploadSummary ? (
        <section className="panel">
          <p className="eyebrow">Latest Upload</p>
          <h2>Preparation status</h2>
          <p>
            Status: <strong>{uploadSummary.status}</strong>
          </p>
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
