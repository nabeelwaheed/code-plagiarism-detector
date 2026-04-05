"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signupProfessor } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { useToast } from "./toast-provider";

export function ProfessorSignupForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUserQuery();

  useEffect(() => {
    if (!currentUserQuery.data) {
      return;
    }

    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/");
  }, [currentUserQuery.data, router]);

  const signupMutation = useMutation({
    mutationFn: () => signupProfessor(email, password),
    onSuccess: () => {
      pushToast({
        tone: "success",
        title: "Professor account created",
        description: "You can start creating assignments immediately.",
      });
      router.push("/professor");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }

    setValidationError(null);
    signupMutation.mutate();
  };

  return (
    <section className="auth-card fade-up">
      <div className="auth-copy">
        <div className="icon-badge" aria-hidden="true">
          +
        </div>
        <p className="eyebrow">Professor Access</p>
        <h1 className="page-title">Create a professor account</h1>
        <p className="secondary-text">
          Open signup is enabled for this project. Create an account to manage assignments and
          review results.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="input-grid">
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input-control"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span className="field-label">Confirm password</span>
            <input
              className="input-control"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
        </div>

        {validationError ? (
          <div className="error-panel">
            <strong>Check your password confirmation</strong>
            <p>{validationError}</p>
          </div>
        ) : null}

        {signupMutation.error ? (
          <div className="error-panel">
            <strong>Account creation failed</strong>
            <p>{signupMutation.error.message}</p>
          </div>
        ) : null}

        <button className="primary-button button-full" disabled={signupMutation.isPending} type="submit">
          {signupMutation.isPending ? "Creating account..." : "Create professor account"}
        </button>
      </form>

      <p className="helper-text">
        Already have an account?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
