"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { changePassword, deleteOwnAccount } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

export function ProfessorSettingsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUserQuery = useCurrentUserQuery();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteLocalError, setDeleteLocalError] = useState<string | null>(null);
  const session = currentUserQuery.data ?? null;

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLocalError(null);
      setSuccessMessage("Password updated successfully.");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteOwnAccount(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.replace("/login?message=account-deleted");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

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

  const handleDeleteAccount = () => {
    setDeleteLocalError(null);

    if (deleteConfirmationText.trim() !== "DELETE") {
      setDeleteLocalError('Type "DELETE" to confirm account deletion.');
      return;
    }

    deleteAccountMutation.mutate();
  };

  if (!session) {
    return <p className="panel">Sign in as a professor to manage account settings.</p>;
  }

  if (session.role !== "professor") {
    return <p className="panel">Only professor accounts can manage these settings.</p>;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Account settings</p>
          <h1>Professor account</h1>
          <p className="subtle-text">Review your email and change your password.</p>
        </div>
        <div className="toolbar-row">
          <Link className="secondary-button as-link" href="/professor">
            Back to professor home
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="stack-sm">
          <h2>Email</h2>
          <p className="subtle-text">{session.email}</p>
        </div>
      </section>

      <section className="panel">
        <h2>Change password</h2>
        <form className="form-stack form-compact" onSubmit={handleSubmit}>
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={changePasswordMutation.isPending}
            type="submit"
          >
            {changePasswordMutation.isPending ? "Saving..." : "Change password"}
          </button>
          {localError ? <p className="error-text">{localError}</p> : null}
          {changePasswordMutation.error ? (
            <p className="error-text">{changePasswordMutation.error.message}</p>
          ) : null}
          {successMessage ? (
            <div className="alert alert-info">
              <p>{successMessage}</p>
            </div>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <div className="stack-sm">
          <div>
            <p className="eyebrow">Danger zone</p>
            <h2>Delete account</h2>
          </div>
          <p className="subtle-text">
            Deleting your account permanently removes your professor access, owned assignments,
            related uploads, and comparison data.
          </p>

          {!isDeleteConfirmOpen ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setSuccessMessage(null);
                setDeleteLocalError(null);
                setDeleteConfirmationText("");
                setIsDeleteConfirmOpen(true);
              }}
            >
              Delete account
            </button>
          ) : (
            <div className="surface-muted stack-sm">
              <p>
                <strong>Are you sure you want to delete your account?</strong>
              </p>
              <p className="muted-text">
                This cannot be undone. Type <strong>DELETE</strong> to confirm.
              </p>
              <label className="field">
                <span>Confirmation text</span>
                <input
                  value={deleteConfirmationText}
                  onChange={(event) => setDeleteConfirmationText(event.target.value)}
                  placeholder="DELETE"
                />
              </label>
              <div className="toolbar-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setDeleteConfirmationText("");
                    setDeleteLocalError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="secondary-button"
                  disabled={deleteAccountMutation.isPending}
                  type="button"
                  onClick={handleDeleteAccount}
                >
                  {deleteAccountMutation.isPending ? "Deleting..." : "Delete account permanently"}
                </button>
              </div>
              {deleteLocalError ? <p className="error-text">{deleteLocalError}</p> : null}
              {deleteAccountMutation.error ? (
                <p className="error-text">{deleteAccountMutation.error.message}</p>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
