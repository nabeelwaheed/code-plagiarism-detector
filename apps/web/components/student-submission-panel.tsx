"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { Upload, ChevronDown, CheckCircle2, Users, FileArchive } from "lucide-react";
import {
  getPublicUploadBatch,
  getSubmissionIdentityPublicKey,
  uploadPublicBulkStudentArchive,
  uploadPublicStudentArchive,
} from "../lib/api";
import { encryptSubmissionIdentity, normalizeAssignmentKey } from "../lib/submission-identity";
import { useToast } from "./toast-provider";

type UploadMode = "single" | "bulk" | null;

interface SingleSubmissionErrors {
  studentName?: string;
  studentNumber?: string;
  studentEmail?: string;
  assignmentKey?: string;
  file?: string;
}

interface BulkSubmissionErrors {
  assignmentKey?: string;
  file?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StudentSubmissionPanel() {
  const { pushToast } = useToast();
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [assignmentKey, setAssignmentKey] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkAssignmentKey, setBulkAssignmentKey] = useState("");
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);
  const [lastUploadBatchId, setLastUploadBatchId] = useState<string | null>(null);
  const [lastStatusToken, setLastStatusToken] = useState<string | null>(null);
  const [lastUploadMode, setLastUploadMode] = useState<UploadMode>(null);
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [singleErrors, setSingleErrors] = useState<SingleSubmissionErrors>({});
  const [bulkErrors, setBulkErrors] = useState<BulkSubmissionErrors>({});
  const [singleAttempted, setSingleAttempted] = useState(false);
  const [bulkAttempted, setBulkAttempted] = useState(false);

  const validateSingle = (overrides?: Partial<{
    studentName: string;
    studentNumber: string;
    studentEmail: string;
    assignmentKey: string;
    selectedFile: File | null;
  }>) => validateSingleSubmission({
    studentName: overrides?.studentName ?? studentName,
    studentNumber: overrides?.studentNumber ?? studentNumber,
    studentEmail: overrides?.studentEmail ?? studentEmail,
    assignmentKey: overrides?.assignmentKey ?? assignmentKey,
    file: overrides?.selectedFile ?? selectedFile,
  });

  const validateBulk = (overrides?: Partial<{
    assignmentKey: string;
    selectedFile: File | null;
  }>) => validateBulkSubmission({
    assignmentKey: overrides?.assignmentKey ?? bulkAssignmentKey,
    file: overrides?.selectedFile ?? selectedBulkFile,
  });

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
      setLastUploadMode("single");
      setSubmitted(true);
      setSingleErrors({});
      setSingleAttempted(false);
      pushToast({ tone: "success", title: "Submission received", description: "Your code is being processed." });
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
      setSubmitted(true);
      setBulkErrors({});
      setBulkAttempted(false);
      pushToast({ tone: "success", title: "Batch upload received", description: "Submissions are being extracted and processed." });
    },
  });

  useQuery({
    queryKey: ["public-upload-batch", lastUploadBatchId, lastStatusToken],
    queryFn: () => getPublicUploadBatch(lastUploadBatchId!, lastStatusToken!),
    enabled: Boolean(lastUploadBatchId && lastStatusToken),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : 3000;
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSingleAttempted(true);
    const nextErrors = validateSingle();
    setSingleErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      return;
    }
    uploadMutation.mutate();
  };

  const handleBulkSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBulkAttempted(true);
    const nextErrors = validateBulk();
    setBulkErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      return;
    }
    bulkUploadMutation.mutate();
  };

  const resetStudentSubmission = () => {
    setSubmitted(false);
    setStudentName("");
    setStudentNumber("");
    setStudentEmail("");
    setAssignmentKey("");
    setSelectedFile(null);
    setBulkAssignmentKey("");
    setSelectedBulkFile(null);
    setLastUploadBatchId(null);
    setLastStatusToken(null);
    setLastUploadMode(null);
    setSingleErrors({});
    setBulkErrors({});
    setSingleAttempted(false);
    setBulkAttempted(false);
  };

  if (submitted && lastUploadMode) {
    const title = lastUploadMode === "bulk" ? "Batch Received" : "Submission Received";
    const description = lastUploadMode === "bulk"
      ? "Each archive is being unpacked and prepared for instructor review."
      : "Your assignment archive is encrypted, queued, and being prepared for processing.";

    return (
      <section className="submission-panel fade-up">
        <div className="submission-card submission-success-card">
          <div className="submission-success-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="stack-xs" style={{ textAlign: "center" }}>
            <p className="eyebrow">Ready for Processing</p>
            <h1 className="section-title">{title}</h1>
            <p className="secondary-text">{description}</p>
          </div>
          <button className="secondary-button" onClick={resetStudentSubmission} type="button">
            Submit Another Archive
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="submission-panel fade-up">
      <div className="submission-card">
        <form className="form-stack" noValidate onSubmit={handleSubmit}>
          {singleAttempted && hasValidationErrors(singleErrors) ? (
            <ValidationSummary
              heading="Please review the highlighted submission details."
              messages={validationMessages(singleErrors)}
            />
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="student-name">
              Full Name <span className="required-mark">*</span>
            </label>
            <input
              id="student-name"
              aria-describedby={singleErrors.studentName ? "student-name-error" : undefined}
              aria-invalid={Boolean(singleErrors.studentName)}
              className={`input-control${singleErrors.studentName ? " is-invalid" : ""}`}
              value={studentName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setStudentName(nextValue);
                if (singleAttempted) {
                  setSingleErrors(validateSingle({ studentName: nextValue }));
                }
              }}
              placeholder="e.g. Jane Smith"
              autoComplete="name"
            />
            {singleErrors.studentName ? <p className="field-error" id="student-name-error">{singleErrors.studentName}</p> : null}
          </div>

          <div className="split-grid submission-split-grid">
            <div className="field">
              <label className="field-label" htmlFor="student-number">
                Student Number <span className="required-mark">*</span>
              </label>
              <input
                id="student-number"
                aria-describedby={singleErrors.studentNumber ? "student-number-error" : undefined}
                aria-invalid={Boolean(singleErrors.studentNumber)}
                className={`input-control${singleErrors.studentNumber ? " is-invalid" : ""}`}
                value={studentNumber}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setStudentNumber(nextValue);
                  if (singleAttempted) {
                    setSingleErrors(validateSingle({ studentNumber: nextValue }));
                  }
                }}
                inputMode="numeric"
                placeholder="e.g. 7654321"
              />
              {singleErrors.studentNumber ? (
                <p className="field-error" id="student-number-error">{singleErrors.studentNumber}</p>
              ) : (
                <p className="field-hint">Use the number listed on your student record.</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="student-email">
                Email <span className="field-label-note">(optional)</span>
              </label>
              <input
                id="student-email"
                aria-describedby={singleErrors.studentEmail ? "student-email-error" : "student-email-hint"}
                aria-invalid={Boolean(singleErrors.studentEmail)}
                className={`input-control${singleErrors.studentEmail ? " is-invalid" : ""}`}
                type="email"
                value={studentEmail}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setStudentEmail(nextValue);
                  if (singleAttempted) {
                    setSingleErrors(validateSingle({ studentEmail: nextValue }));
                  }
                }}
                placeholder="jsmith@university.edu"
                autoComplete="email"
              />
              {singleErrors.studentEmail ? (
                <p className="field-error" id="student-email-error">{singleErrors.studentEmail}</p>
              ) : (
                <p className="field-hint" id="student-email-hint">Optional, but useful if your instructor requests follow-up.</p>
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="assignment-key">
              Assignment Key <span className="required-mark">*</span>
            </label>
            <input
              id="assignment-key"
              aria-describedby={singleErrors.assignmentKey ? "assignment-key-error" : "assignment-key-hint"}
              aria-invalid={Boolean(singleErrors.assignmentKey)}
              className={`input-control mono${singleErrors.assignmentKey ? " is-invalid" : ""}`}
              value={assignmentKey}
              onChange={(event) => {
                const nextValue = event.target.value;
                setAssignmentKey(nextValue);
                if (singleAttempted) {
                  setSingleErrors(validateSingle({ assignmentKey: nextValue }));
                }
              }}
              placeholder="Paste the key provided by your instructor"
            />
            {singleErrors.assignmentKey ? (
              <p className="field-error" id="assignment-key-error">{singleErrors.assignmentKey}</p>
            ) : (
              <p className="field-hint" id="assignment-key-hint">Your course staff will usually share this key in class or through the LMS.</p>
            )}
          </div>

          <CompactDropzone
            error={singleErrors.file}
            file={selectedFile}
            id="single-file"
            onFileSelected={(file) => {
              setSelectedFile(file);
              if (singleAttempted) {
                setSingleErrors(validateSingle({ selectedFile: file }));
              }
            }}
          />

          {uploadMutation.error ? (
            <div className="error-panel">
              <strong>Submission failed</strong>
              <p>{uploadMutation.error.message}</p>
            </div>
          ) : null}

          <button
            className="primary-button button-full submission-submit-button"
            disabled={uploadMutation.isPending}
            type="submit"
          >
            <Upload size={15} />
            {uploadMutation.isPending ? "Encrypting and uploading..." : "Submit Assignment"}
          </button>
        </form>
      </div>

      <div className="submission-secondary">
        <button
          className={`collapsible-trigger${bulkExpanded ? " is-open" : ""}`}
          type="button"
          onClick={() => setBulkExpanded((value) => !value)}
        >
          <Users size={15} />
          <span style={{ flex: 1, textAlign: "left" }}>Batch upload for instructors or TAs</span>
          <ChevronDown size={16} />
        </button>

        <div className={`collapsible-body${bulkExpanded ? " is-open" : ""}`}>
          <div className="stack-sm">
            <p className="secondary-text" style={{ margin: 0 }}>
              Upload a parent zip that contains one student archive per child zip. Each child archive becomes a separate submission record.
            </p>
            <div className="info-panel">
              <strong>Filename visibility</strong>
              <p>Each child archive filename becomes the visible submission label unless your review workflow masks it later.</p>
            </div>

            <form className="form-stack" noValidate onSubmit={handleBulkSubmit}>
              {bulkAttempted && hasValidationErrors(bulkErrors) ? (
                <ValidationSummary
                  heading="Please review the batch upload details."
                  messages={validationMessages(bulkErrors)}
                />
              ) : null}

              <div className="field">
                <label className="field-label" htmlFor="bulk-key">
                  Assignment Key <span className="required-mark">*</span>
                </label>
                <input
                  id="bulk-key"
                  aria-describedby={bulkErrors.assignmentKey ? "bulk-key-error" : undefined}
                  aria-invalid={Boolean(bulkErrors.assignmentKey)}
                  className={`input-control mono${bulkErrors.assignmentKey ? " is-invalid" : ""}`}
                  value={bulkAssignmentKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setBulkAssignmentKey(nextValue);
                    if (bulkAttempted) {
                      setBulkErrors(validateBulk({ assignmentKey: nextValue }));
                    }
                  }}
                  placeholder="Paste the assignment key"
                />
                {bulkErrors.assignmentKey ? <p className="field-error" id="bulk-key-error">{bulkErrors.assignmentKey}</p> : null}
              </div>

              <CompactDropzone
                error={bulkErrors.file}
                file={selectedBulkFile}
                hint="Parent .zip containing student .zip files"
                id="bulk-file"
                label="Batch Archive"
                onFileSelected={(file) => {
                  setSelectedBulkFile(file);
                  if (bulkAttempted) {
                    setBulkErrors(validateBulk({ selectedFile: file }));
                  }
                }}
              />

              {bulkUploadMutation.error ? (
                <div className="error-panel">
                  <strong>Batch upload failed</strong>
                  <p>{bulkUploadMutation.error.message}</p>
                </div>
              ) : null}

              <button
                className="secondary-button button-full"
                disabled={bulkUploadMutation.isPending}
                type="submit"
              >
                <Upload size={14} />
                {bulkUploadMutation.isPending ? "Uploading batch..." : "Upload Batch"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactDropzone({
  error,
  file,
  id,
  label = "Source Code Archive",
  hint = ".zip files only",
  onFileSelected,
}: {
  error?: string;
  file: File | null;
  id: string;
  label?: string;
  hint?: string;
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
    onFileSelected(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className="field">
      <label
        className={`file-dropzone compact-dropzone${isDragActive ? " is-active" : ""}${error ? " is-invalid" : ""}`}
        htmlFor={id}
        onDragEnter={(event) => { event.preventDefault(); setIsDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); setIsDragActive(true); }}
        onDragLeave={(event) => { event.preventDefault(); setIsDragActive(false); }}
        onDrop={handleDrop}
      >
        <div className="compact-dropzone-copy">
          <div className="compact-dropzone-icon">
            {file ? <FileArchive size={15} /> : <Upload size={15} />}
          </div>
          <div className="stack-xs" style={{ minWidth: 0 }}>
            {file ? (
              <>
                <div className="dropzone-title">{file.name}</div>
                <div className="helper-text">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </>
            ) : (
              <>
                <div className="dropzone-title">{label}</div>
                <div className="helper-text">{hint}</div>
              </>
            )}
          </div>
        </div>

        {file ? (
          <button
            className="ghost-button button-compact"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onFileSelected(null);
            }}
          >
            Remove
          </button>
        ) : (
          <button
            className="secondary-button button-compact"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
          >
            Browse
          </button>
        )}

        <input
          ref={inputRef}
          accept=".zip"
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          className="hidden-input"
          id={id}
          onChange={handleChange}
          type="file"
        />
      </label>
      {error ? <p className="field-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

function ValidationSummary({ heading, messages }: { heading: string; messages: string[] }) {
  return (
    <div className="validation-summary" role="alert">
      <strong>{heading}</strong>
      <ul>
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </div>
  );
}

function validateSingleSubmission(input: {
  studentName: string;
  studentNumber: string;
  studentEmail: string;
  assignmentKey: string;
  file: File | null;
}): SingleSubmissionErrors {
  const errors: SingleSubmissionErrors = {};

  if (!input.studentName.trim()) {
    errors.studentName = "Enter the full name associated with this submission.";
  }

  const normalizedNumber = input.studentNumber.trim();
  if (!normalizedNumber) {
    errors.studentNumber = "Enter your student number before submitting.";
  } else if (!/^\d{6,12}$/.test(normalizedNumber)) {
    errors.studentNumber = "Use digits only for the student number, usually 6 to 12 digits.";
  }

  const normalizedEmail = input.studentEmail.trim();
  if (normalizedEmail && !emailPattern.test(normalizedEmail)) {
    errors.studentEmail = "Enter a valid email address or leave this field blank.";
  }

  const normalizedKey = normalizeAssignmentKey(input.assignmentKey);
  if (!normalizedKey) {
    errors.assignmentKey = "Paste the assignment key exactly as your instructor provided it.";
  } else if (normalizedKey.length < 6) {
    errors.assignmentKey = "That assignment key looks incomplete. Paste the full key to continue.";
  }

  if (!input.file) {
    errors.file = "Choose the zip archive that contains the files for this submission.";
  } else if (!input.file.name.toLowerCase().endsWith(".zip")) {
    errors.file = "Upload a .zip archive for this assignment.";
  }

  return errors;
}

function validateBulkSubmission(input: {
  assignmentKey: string;
  file: File | null;
}): BulkSubmissionErrors {
  const errors: BulkSubmissionErrors = {};

  const normalizedKey = normalizeAssignmentKey(input.assignmentKey);
  if (!normalizedKey) {
    errors.assignmentKey = "Paste the assignment key for this batch upload.";
  }

  if (!input.file) {
    errors.file = "Choose the parent .zip archive before starting the batch upload.";
  } else if (!input.file.name.toLowerCase().endsWith(".zip")) {
    errors.file = "Batch uploads must use a .zip archive.";
  }

  return errors;
}

function hasValidationErrors(errors: object) {
  return Object.values(errors).some(Boolean);
}

function validationMessages(errors: object) {
  return Object.values(errors).filter((value): value is string => Boolean(value));
}
