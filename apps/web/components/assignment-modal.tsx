"use client";

import { FormEvent } from "react";
import { X } from "lucide-react";

interface AssignmentFormState {
  title: string;
  language: "java" | "c" | "cpp";
  dueDate: string;
}

interface AssignmentModalProps {
  open: boolean;
  formState: AssignmentFormState;
  isEditing?: boolean;
  isPending?: boolean;
  error?: string | null;
  onChange: (state: AssignmentFormState) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function AssignmentModal({
  open,
  formState,
  isEditing = false,
  isPending = false,
  error,
  onChange,
  onSubmit,
  onClose,
}: AssignmentModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? "Edit Assignment" : "New Assignment"}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="modal-title">
                Assignment Title <span style={{ color: "var(--accent-red)" }}>*</span>
              </label>
              <input
                id="modal-title"
                className="form-input"
                value={formState.title}
                onChange={(e) => onChange({ ...formState, title: e.target.value })}
                placeholder="e.g. Assignment 2"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-language">
                Language <span style={{ color: "var(--accent-red)" }}>*</span>
              </label>
              <select
                id="modal-language"
                className="form-input"
                value={formState.language}
                onChange={(e) => onChange({ ...formState, language: e.target.value as AssignmentFormState["language"] })}
              >
                <option value="java">Java</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-due-date">
                Due Date <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="modal-due-date"
                className="form-input"
                type="datetime-local"
                value={formState.dueDate}
                onChange={(e) => onChange({ ...formState, dueDate: e.target.value })}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
                Shown in your local time. Deadlines are informational only.
              </span>
            </div>

            {error && (
              <div className="alert alert-error" style={{ fontSize: "0.85rem" }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isPending || !formState.title.trim()}
            >
              {isPending
                ? isEditing ? "Saving..." : "Creating..."
                : isEditing ? "Save Changes" : "Create Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
