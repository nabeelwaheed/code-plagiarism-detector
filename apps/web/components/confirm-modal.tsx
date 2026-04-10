"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  details?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  details,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {danger && <AlertTriangle size={18} color="var(--accent-red)" />}
            <h2 style={{ fontSize: "1rem" }}>{title}</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{message}</p>
          {details ? <div style={{ marginTop: "0.9rem" }}>{details}</div> : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
