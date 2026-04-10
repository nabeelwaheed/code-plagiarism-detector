"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileArchive, Lock, Mail, Upload, User } from "lucide-react";
import {
  getPublicUploadBatch,
  getSubmissionIdentityPublicKey,
  uploadPublicBulkStudentArchive,
  uploadPublicStudentArchive,
} from "../lib/api";
import {
  encryptSubmissionIdentity,
  normalizeAssignmentKey,
} from "../lib/submission-identity";

function FileDropInput({
  accept,
  file,
  onChange,
}: {
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [file]);

  return (
    <label
      className={`upload-drop-area ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onClick={(e) => {
          e.currentTarget.value = "";
        }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <FileArchive size={28} style={{ margin: "0 auto 0.6rem", opacity: 0.5 }} />
      {file ? (
        <div>
          <strong style={{ fontSize: "0.9rem" }}>{file.name}</strong>
          <p style={{ fontSize: "0.78rem", marginTop: "0.25rem", opacity: 0.7 }}>
            {(file.size / 1024).toFixed(0)} KB — Click or drag to replace
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Drop your .zip file here</p>
          <p style={{ fontSize: "0.78rem", marginTop: "0.25rem", opacity: 0.7 }}>
            or click to browse
          </p>
        </div>
      )}
    </label>
  );
}

export function StudentSubmissionPanel() {
  const [studentName, setStudentName] = useState(
    process.env.NODE_ENV === "production" ? "" : "",
  );
  const [studentNumber, setStudentNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [assignmentKey, setAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Bulk upload — collapsed by default for cleaner UX
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAssignmentKey, setBulkAssignmentKey] = useState(
    process.env.NODE_ENV === "production" ? "" : "demo-key-1234",
  );
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);
  const [lastUploadBatchId, setLastUploadBatchId] = useState<string | null>(null);
  const [lastStatusToken, setLastStatusToken] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const encryptionKey = await getSubmissionIdentityPublicKey();
      const encryptedIdentity = await encryptSubmissionIdentity(
        { studentName, studentNumber, studentEmail, assignmentKey },
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
      setSelectedFile(null);
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
      setSelectedBulkFile(null);
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
    Boolean(selectedFile) &&
    Boolean(studentName.trim()) &&
    Boolean(studentNumber.trim()) &&
    Boolean(assignmentKey.trim());

  const isBulkSubmitEnabled =
    Boolean(selectedBulkFile) && Boolean(bulkAssignmentKey.trim());

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSubmitEnabled) return;
    uploadMutation.mutate();
  };

  const handleBulkSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isBulkSubmitEnabled) return;
    bulkUploadMutation.mutate();
  };

  const statusBadge = uploadSummary?.status;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "2rem 1rem 3rem",
      }}
    >
      {/* Page header */}
      <div style={{ maxWidth: 640, width: "100%", marginBottom: "1.75rem", textAlign: "center" }}>
        <p
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--brand)",
            marginBottom: "0.5rem",
          }}
        >
          Student Submission
        </p>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15, marginBottom: "0.6rem" }}>
          Submit Your Assignment
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: 500, margin: "0 auto 1rem" }}>
          Enter your details, provide the assignment key, and upload your zip. Your identity is
          encrypted in your browser before anything is sent to the server.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem" }}>
          <Link href="/login" className="btn btn-outline btn-sm">
            Instructor Access
          </Link>
        </div>
      </div>

      {/* Main submission card */}
      <div className="glass-panel animate-fade-in" style={{ maxWidth: 560, width: "100%", padding: "1.75rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Submission Form</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="s-name">
                Full Name <span style={{ color: "var(--accent-red)" }}>*</span>
              </label>
              <div className="input-with-icon">
                <User />
                <input
                  id="s-name"
                  className="form-input"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Jane Student"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="s-number">
                Student Number <span style={{ color: "var(--accent-red)" }}>*</span>
              </label>
              <input
                id="s-number"
                className="form-input"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="1234567"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-email">
              Email <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span>
            </label>
            <div className="input-with-icon">
              <Mail />
              <input
                id="s-email"
                className="form-input"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-key">
              Assignment Key <span style={{ color: "var(--accent-red)" }}>*</span>
            </label>
            <input
              id="s-key"
              className="form-input"
              value={assignmentKey}
              onChange={(e) => setAssignmentKey(e.target.value)}
              placeholder="Enter the key given by your instructor"
              required
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Zip Archive <span style={{ color: "var(--accent-red)" }}>*</span>
            </label>
            <FileDropInput accept=".zip" file={selectedFile} onChange={setSelectedFile} />
          </div>

          <button
            className="btn btn-primary"
            disabled={uploadMutation.isPending || !isSubmitEnabled}
            type="submit"
            style={{ width: "100%", marginTop: "0.25rem" }}
          >
            <Upload size={16} />
            {uploadMutation.isPending ? "Encrypting & Uploading..." : "Submit Assignment"}
          </button>

          {uploadMutation.error && (
            <div className="alert alert-error">{uploadMutation.error.message}</div>
          )}
        </form>

        {/* Privacy note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "1.25rem", padding: "0.75rem", background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)" }}>
          <Lock size={13} style={{ marginTop: "0.15rem", flexShrink: 0, color: "var(--text-tertiary)" }} />
          <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
            Your name, student number, and email are encrypted using your institution&apos;s public key
            before submission. Only the instructor can decrypt your identity.
          </p>
        </div>
      </div>

      {/* Upload status */}
      {uploadSummary && (
        <div
          className="glass-card animate-fade-in"
          style={{ maxWidth: 560, width: "100%", padding: "1.25rem", marginTop: "1rem" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.95rem", margin: 0 }}>Submission Status</h3>
            <span
              className={`status-badge ${
                statusBadge === "ready" ? "badge-ready" :
                statusBadge === "failed" ? "badge-failed" :
                "badge-running"
              }`}
            >
              {statusBadge}
            </span>
          </div>
          {uploadSummary.errorMessage && (
            <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
              {uploadSummary.errorMessage}
            </div>
          )}
          {uploadSummary.submissions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {uploadSummary.submissions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    padding: "0.4rem 0.6rem",
                    background: "var(--bg-surface-raised)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <FileArchive size={13} />
                  <span style={{ fontWeight: 600 }}>{s.displayName}</span>
                  <span className="status-badge badge-ready" style={{ marginLeft: "auto", fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>
                    {s.kind}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>
              Your archive is being prepared. This usually takes a few seconds.
            </p>
          )}
        </div>
      )}

      {/* Bulk upload — accordion */}
      <div
        className="glass-card"
        style={{ maxWidth: 560, width: "100%", marginTop: "1rem", overflow: "hidden" }}
      >
        <button
          className="accordion-trigger"
          onClick={() => setBulkOpen((v) => !v)}
          type="button"
        >
          <span>Bulk Upload (TA / Marker Flow)</span>
          {bulkOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {bulkOpen && (
          <div style={{ padding: "0 1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              Upload one parent zip containing child zip files — one per submission. Each child zip
              filename stem becomes the visible submission name.
            </p>
            <div
              style={{
                padding: "0.75rem",
                background: "var(--accent-yellow-soft)",
                border: "1px solid rgba(217,119,6,0.2)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.8rem",
                color: "#92400e",
              }}
            >
              <strong>Note:</strong> Do not include student names in child zip filenames unless you
              want those names visible to the instructor.
            </div>

            <form onSubmit={handleBulkSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="b-key">
                  Assignment Key <span style={{ color: "var(--accent-red)" }}>*</span>
                </label>
                <input
                  id="b-key"
                  className="form-input"
                  value={bulkAssignmentKey}
                  onChange={(e) => setBulkAssignmentKey(e.target.value)}
                  placeholder="Enter assignment key"
                  required
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Parent Zip Archive <span style={{ color: "var(--accent-red)" }}>*</span>
                </label>
                <FileDropInput accept=".zip" file={selectedBulkFile} onChange={setSelectedBulkFile} />
              </div>

              <button
                className="btn btn-outline"
                disabled={bulkUploadMutation.isPending || !isBulkSubmitEnabled}
                type="submit"
                style={{ width: "100%" }}
              >
                <Upload size={15} />
                {bulkUploadMutation.isPending ? "Uploading..." : "Upload Bulk Archive"}
              </button>

              {bulkUploadMutation.error && (
                <div className="alert alert-error">{bulkUploadMutation.error.message}</div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
