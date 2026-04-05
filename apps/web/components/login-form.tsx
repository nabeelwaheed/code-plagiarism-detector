"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { login } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { useToast } from "./toast-provider";

export function LoginForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState(
    process.env.NODE_ENV === "production" ? "" : "professor@example.com",
  );
  const [password, setPassword] = useState(
    process.env.NODE_ENV === "production" ? "" : "professor123",
  );
  const currentUserQuery = useCurrentUserQuery();

  useEffect(() => {
    if (!currentUserQuery.data) {
      return;
    }

    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/");
  }, [currentUserQuery.data, router]);

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (session) => {
      pushToast({
        tone: "success",
        title: "Signed in",
        description: "Your professor session is active.",
      });
      router.push(session.role === "professor" ? "/professor" : "/");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return (
    <section className="auth-card fade-up">
      <div className="auth-copy">
        <div className="icon-badge" aria-hidden="true">
          P
        </div>
        <p className="eyebrow">Professor Access</p>
        <h1 className="page-title">Sign in to review assignments</h1>
        <p className="secondary-text">
          Use your existing professor account to manage uploads, run comparisons, and inspect
          suspicious pairs.
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
              autoComplete="current-password"
            />
          </label>
        </div>

        {loginMutation.error ? (
          <div className="error-panel">
            <strong>Sign-in failed</strong>
            <p>{loginMutation.error.message}</p>
          </div>
        ) : null}

        <button className="primary-button button-full" disabled={loginMutation.isPending} type="submit">
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="helper-text">
        Need an account?{" "}
        <Link className="text-link" href="/signup">
          Create a professor account
        </Link>
      </p>
    </section>
  );
}
