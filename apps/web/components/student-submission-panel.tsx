"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  getPublicUploadBatch,
  getSubmissionIdentityPublicKey,
  uploadPublicBulkStudentArchive,
  uploadPublicStudentArchive,
} from "../lib/api";
import { formatDateTime, formatLanguageLabel, formatStatusLabel, getStatusTone } from "../lib/view-models";
import {
  encryptSubmissionIdentity,
  normalizeAssignmentKey,
} from "../lib/submission-identity";
import { useToast } from "./toast-provider";

type UploadMode = "single" | "bulk" | null;

export function StudentSubmissionPanel() {
  const { pushToast } = useToast();
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [assignmentKey, setAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkAssignmentKey, setBulkAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);
  const [lastUploadBatchId, setLastUploadBatchId] = useState<string | null>(null);
  const [lastStatusToken, setLastStatusToken] = useState<string | null>(null);
  const [lastUploadMode, setLastUploadMode] = useState<UploadMode>(null);
  const [lastAssignmentLanguage, setLastAssignmentLanguage] = useState<"java" | "c" | "cpp" | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const encryptionKey = await getSubmissionIdentityPublicKey();
      const encryptedIdentity = await encryptSubmissionIdentity(
        {
          studentName,
          studentNumber,
          studentEmail,
          assignmentKey,
        },
        encryptionKey,
      );

      return uploadPublicStudentArchive({
        assignmentKey: normalizeAssignmentKey(assignmentKey),
        encryptedIdentity,
        file: selectedFile!,
      });
    },
    onSuccess: (result) => {
      setLastUploadBatchId(result.uploadBatchId);
      setLastStatusToken(result.statusToken);
      setLastUploadMode("single");
      setLastAssignmentLanguage(result.assignmentLanguage);
      setSelectedFile(null);
      pushToast({
        tone: "success",
        title: "Submission received",
        description: "Your upload is being prepared and checked.",
      });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: () =>
      uploadPublicBulkStudentArchive({
        assignmentKey: normalizeAssignmentKey(bulkAssignmentKey),
        file: selectedBulkFile!,
      }),
    onSuccess: (result) => {
      setLastUploadBatchId(result.uploadBatchId);
      setLastStatusToken(result.statusToken);
      setLastUploadMode("bulk");
      setLastAssignmentLanguage(result.assignmentLanguage);
      setSelectedBulkFile(null);
      pushToast({
        tone: "success",
        title: "Bulk archive received",
        description: "The parent archive is being prepared into current submissions.",
      });
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

  const uploadSummary = uploadStatusQuery.data ?? null;
  const isSubmitEnabled =
    Boolean(selectedFile)
    && Boolean(studentName.trim())
    && Boolean(studentNumber.trim())
    && Boolean(assignmentKey.trim());
  const isBulkSubmitEnabled = Boolean(selectedBulkFile) && Boolean(bulkAssignmentKey.trim());

  const receiptTitle = useMemo(() => {
    if (!uploadSummary) {
      return "Ready to receive a submission";
    }

    if (lastUploadMode === "bulk") {
      return "Bulk upload receipt";
    }

    return "Submission receipt";
  }, [lastUploadMode, uploadSummary]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !studentName.trim() || !studentNumber.trim() || !assignmentKey.trim()) {
      return;
    }

    uploadMutation.mutate();
  };

  const handleBulkSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBulkFile || !bulkAssignmentKey.trim()) {
      return;
    }

    bulkUploadMutation.mutate();
  };

  return (
    <div className="shell-stack fade-up">
      <section className="hero-card">
        <div className="hero-grid">
          <div className="card-stack">
            <div className="stack-sm">
              <p className="eyebrow">Public Student Upload</p>
              <h1 className="page-title">Submit one zip archive to one assignment keyID</h1>
              <p className="secondary-text">
                Student identity is encrypted in the browser before the upload request is sent. The
                professor workflow can reveal it later when needed.
              </p>
            </div>
            <div className="toolbar-row">
              <span className="status-pill tone-brand">Encrypted identity flow</span>
              <span className="status-pill tone-neutral">One student upload = one zip</span>
            </div>
          </div>

          <div className="action-row">
            <Link className="secondary-button as-link" href="/login">
              Professor sign in
            </Link>
            <Link className="primary-button as-link" href="/signup">
              Professor sign up
            </Link>
          </div>
        </div>
      </section>

      <section className="receipt-card">
        <div className="section-heading">
          <div className="stack-xs">
            <p className="eyebrow">Status</p>
            <h2 className="section-title">{receiptTitle}</h2>
          </div>
          {uploadSummary ? (
            <span className={`status-pill tone-${getStatusTone(uploadSummary.status)}`}>
              {formatStatusLabel(uploadSummary.status)}
            </span>
          ) : (
            <span className="status-pill tone-neutral">Waiting for upload</span>
          )}
        </div>

        {!uploadSummary ? (
          <div className="receipt-grid">
            <div className="surface-soft">
              <div className="detail-item">
                <span>Normal submission</span>
                <strong>Student details + zip</strong>
              </div>
            </div>
            <div className="surface-soft">
              <div className="detail-item">
                <span>Bulk demo route</span>
                <strong>Parent zip with direct child zips</strong>
              </div>
            </div>
            <div className="surface-soft">
              <div className="detail-item">
                <span>Status updates</span>
                <strong>Polled automatically</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-stack">
            <div className="receipt-grid">
              <div className="surface-soft">
                <div className="detail-item">
                  <span>Assignment</span>
                  <strong className="mono">{uploadSummary.assignmentId}</strong>
                </div>
              </div>
              <div className="surface-soft">
                <div className="detail-item">
                  <span>Started</span>
                  <strong>{formatDateTime(uploadSummary.createdAt)}</strong>
                </div>
              </div>
              <div className="surface-soft">
                <div className="detail-item">
                  <span>Updated</span>
                  <strong>{formatDateTime(uploadSummary.updatedAt)}</strong>
                </div>
              </div>
            </div>

            {uploadSummary.errorMessage ? (
              <div className="error-panel">
                <strong>Upload needs attention</strong>
                <p>{uploadSummary.errorMessage}</p>
              </div>
            ) : null}

            {uploadSummary.submissions.length > 0 ? (
              <div className="section-card">
                <div className="section-heading">
                  <div className="stack-xs">
                    <p className="eyebrow">Prepared submissions</p>
                    <h3 className="card-title">
                      {uploadSummary.submissions.length} submission
                      {uploadSummary.submissions.length === 1 ? "" : "s"} ready
                    </h3>
                  </div>
                  {lastAssignmentLanguage ? (
                    <span className="status-pill tone-success">
                      {formatLanguageLabel(lastAssignmentLanguage)}
                    </span>
                  ) : null}
                </div>
                <div className="assignment-card-grid">
                  {uploadSummary.submissions.map((submission) => (
                    <article className="assignment-summary-card" key={submission.id}>
                      <div className="detail-item">
                        <span>Submission</span>
                        <strong>{submission.displayName}</strong>
                      </div>
                      <div className="toolbar-row">
                        <span className="status-pill tone-neutral">{submission.kind}</span>
                        <span className="helper-text">{formatDateTime(submission.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="info-panel">
                <strong>Preparation in progress</strong>
                <p>The upload has been accepted and is still being prepared or queued.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="upload-mode-grid">
        <section className="upload-card">
          <div className="stack-sm">
            <p className="eyebrow">Normal Flow</p>
            <h2 className="section-title">Single student submission</h2>
            <p className="secondary-text">
              Use this path for the standard one-student, one-zip submission flow. Raw identity is
              not sent in plain form.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="input-grid">
              <label className="field">
                <span className="field-label">
                  Student name <span className="required-mark">*</span>
                </span>
                <input
                  className="input-control"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Jane Student"
                />
              </label>
              <div className="split-grid">
                <label className="field">
                  <span className="field-label">
                    Student number <span className="required-mark">*</span>
                  </span>
                  <input
                    className="input-control"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(event.target.value)}
                    placeholder="1234567"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Student email</span>
                  <input
                    className="input-control"
                    value={studentEmail}
                    onChange={(event) => setStudentEmail(event.target.value)}
                    placeholder="Optional"
                    type="email"
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">
                  Assignment keyID <span className="required-mark">*</span>
                </span>
                <input
                  className="input-control mono"
                  value={assignmentKey}
                  onChange={(event) => setAssignmentKey(event.target.value)}
                  placeholder="Enter your assignment key"
                />
              </label>
            </div>

            <FileDropzone
              file={selectedFile}
              id="single-upload"
              label="Zip archive"
              description="Drag and drop one .zip file, or click to browse."
              onFileSelected={setSelectedFile}
            />

            {uploadMutation.error ? (
              <div className="error-panel">
                <strong>Submission failed</strong>
                <p>{uploadMutation.error.message}</p>
              </div>
            ) : null}

            <button
              className="primary-button button-full"
              disabled={uploadMutation.isPending || !isSubmitEnabled}
              type="submit"
            >
              {uploadMutation.isPending ? "Encrypting and uploading..." : "Submit zip"}
            </button>
          </form>
        </section>

        <section className="upload-card is-secondary">
          <div className="stack-sm">
            <p className="eyebrow">TA / Demo Bulk Upload</p>
            <h2 className="section-title">Bulk current submissions</h2>
            <p className="secondary-text">
              This is a convenience flow for demos or marker-led testing. Each direct child zip in
              the parent archive becomes one current submission.
            </p>
          </div>

          <div className="alert-panel">
            <strong>Filename reminder</strong>
            <p>
              In the bulk route, the sanitized child zip filename stem becomes the professor-visible
              submission name.
            </p>
          </div>

          <form className="form-stack" onSubmit={handleBulkSubmit}>
            <label className="field">
              <span className="field-label">
                Assignment keyID <span className="required-mark">*</span>
              </span>
              <input
                className="input-control mono"
                value={bulkAssignmentKey}
                onChange={(event) => setBulkAssignmentKey(event.target.value)}
                placeholder="Enter your assignment key"
              />
            </label>

            <FileDropzone
              file={selectedBulkFile}
              id="bulk-upload"
              label="Parent zip archive"
              description="Expected structure: one parent zip with direct child zip files."
              onFileSelected={setSelectedBulkFile}
            />

            {bulkUploadMutation.error ? (
              <div className="error-panel">
                <strong>Bulk upload failed</strong>
                <p>{bulkUploadMutation.error.message}</p>
              </div>
            ) : null}

            {uploadStatusQuery.error ? (
              <div className="error-panel">
                <strong>Status lookup failed</strong>
                <p>{uploadStatusQuery.error.message}</p>
              </div>
            ) : null}

            <button
              className="secondary-button button-full"
              disabled={bulkUploadMutation.isPending || !isBulkSubmitEnabled}
              type="submit"
            >
              {bulkUploadMutation.isPending ? "Uploading bulk archive..." : "Upload bulk archive"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function FileDropzone({
  description,
  file,
  id,
  label,
  onFileSelected,
}: {
  description: string;
  file: File | null;
  id: string;
  label: string;
  onFileSelected: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelected(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(droppedFile);
  };

  return (
    <label
      className={`file-dropzone${isDragActive ? " is-active" : ""}`}
      htmlFor={id}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <div className="dropzone-icon" aria-hidden="true">
        ↑
      </div>
      <div className="stack-xs">
        <strong>{label}</strong>
        <span className="secondary-text">{file ? file.name : description}</span>
        {file ? (
          <span className="helper-text">
            {(file.size / 1024 / 1024).toFixed(2)} MB selected
          </span>
        ) : (
          <span className="helper-text">Accepted format: .zip</span>
        )}
      </div>
      <button
        className="secondary-button button-compact"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          inputRef.current?.click();
        }}
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        className="hidden-input"
        id={id}
        type="file"
        accept=".zip"
        onChange={handleChange}
      />
    </label>
  );
}
