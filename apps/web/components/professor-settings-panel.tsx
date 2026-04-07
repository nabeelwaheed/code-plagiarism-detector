"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, Lock, ShieldAlert, User } from "lucide-react";
import { changePassword, deleteOwnAccount } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { ConfirmModal } from "./confirm-modal";
import { useToast } from "./toast";

export function ProfessorSettingsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUserQuery = useCurrentUserQuery();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const session = currentUserQuery.data ?? null;

  const changePasswordMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLocalError(null);
      showToast("Password updated successfully.", "success");
    },
    onError: (err: Error) => {
      showToast(err.message, "error");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteOwnAccount(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.replace("/login?message=account-deleted");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setLocalError("Please complete all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("New password and confirmation must match.");
      return;
    }
    setLocalError(null);
    changePasswordMutation.mutate();
  };

  if (!session) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Sign in as a professor to manage account settings.</div>;
  }

  if (session.role !== "professor") {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Only professor accounts can manage these settings.</div>;
  }

  return (
    <>
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Account"
        message="This permanently removes your professor access, owned assignments, related uploads, and all comparison data. This cannot be undone."
        confirmLabel="Delete Account"
        danger
        onConfirm={() => { setConfirmDeleteOpen(false); deleteAccountMutation.mutate(); }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Page layout */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem 3rem", width: "100%" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            href="/professor"
            className="btn btn-ghost btn-sm"
            style={{ padding: "0.25rem 0.5rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Account Settings</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "1.75rem" }}>
          Manage your professor account, credentials, and account deletion.
        </p>

        {/* Profile info */}
        <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--brand-soft)",
                border: "1px solid var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={18} color="var(--brand)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{session.email}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Professor Account
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Lock size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: "1rem", margin: 0 }}>Change Password</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="s-cur-pw">Current Password</label>
              <input
                id="s-cur-pw"
                className="form-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="s-new-pw">New Password</label>
              <input
                id="s-new-pw"
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a new password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="s-confirm-pw">Confirm New Password</label>
              <input
                id="s-confirm-pw"
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>

            {localError && <div className="alert alert-error">{localError}</div>}
            {changePasswordMutation.error && (
              <div className="alert alert-error">{changePasswordMutation.error.message}</div>
            )}

            <button
              className="btn btn-primary"
              disabled={changePasswordMutation.isPending}
              type="submit"
            >
              {changePasswordMutation.isPending ? "Saving..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div
          className="glass-card"
          style={{ padding: "1.25rem", borderColor: "rgba(220,38,38,0.25)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <ShieldAlert size={16} color="var(--accent-red)" />
            <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--accent-red)" }}>Danger Zone</h2>
          </div>
          <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            Deleting your account permanently removes your professor access, all owned assignments,
            uploads, and comparison data.
          </p>
          <button
            className="btn btn-danger btn-sm"
            disabled={deleteAccountMutation.isPending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </>
  );
}
