"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, BookOpen, LogIn } from "lucide-react";
import { login } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { useToast } from "./toast-provider";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const currentUserQuery = useCurrentUserQuery();

  useEffect(() => {
    if (!currentUserQuery.data) return;
    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/");
  }, [currentUserQuery.data, router]);

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (session) => {
      pushToast({ tone: "success", title: "Welcome back" });
      router.push(session.role === "professor" ? "/professor" : "/");
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    const nextErrors = validateLoginForm(email, password);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }
    loginMutation.mutate();
  };

  return (
    <section className="auth-card fade-up">
      {/* Brand mark */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "10px",
          background: "var(--brand)", display: "grid", placeItems: "center", color: "#fff",
        }}>
          <BookOpen size={20} strokeWidth={2} />
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.3rem" }}>Instructor Access</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.025em", margin: 0 }}>
            Sign In
          </h1>
          <p style={{ margin: "0.4rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
            Manage assignments and review code similarity results.
          </p>
        </div>
      </div>

      {/* Form */}
      <form noValidate onSubmit={handleSubmit} style={{ display: "grid", gap: "0.85rem" }}>
        {attemptedSubmit && Object.values(errors).some(Boolean) ? (
          <div className="validation-summary" role="alert">
            <strong>Please review the sign-in details below.</strong>
            <ul>
              {Object.values(errors).filter(Boolean).map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            aria-describedby={errors.email ? "login-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
            className={`input-control${errors.email ? " is-invalid" : ""}`}
            value={email}
            onChange={(e) => {
              const nextValue = e.target.value;
              setEmail(nextValue);
              if (attemptedSubmit) {
                setErrors(validateLoginForm(nextValue, password));
              }
            }}
            type="email"
            autoComplete="email"
            placeholder="instructor@university.edu"
          />
          {errors.email ? <p className="field-error" id="login-email-error">{errors.email}</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">Password</label>
          <div className="input-wrap">
            <input
              id="password"
              aria-describedby={errors.password ? "login-password-error" : undefined}
              aria-invalid={Boolean(errors.password)}
              className={`input-control has-suffix${errors.password ? " is-invalid" : ""}`}
              value={password}
              onChange={(e) => {
                const nextValue = e.target.value;
                setPassword(nextValue);
                if (attemptedSubmit) {
                  setErrors(validateLoginForm(email, nextValue));
                }
              }}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
            <button
              className="input-suffix-btn"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password ? <p className="field-error" id="login-password-error">{errors.password}</p> : null}
        </div>

        {loginMutation.error ? (
          <div className="error-panel">
            <strong>Sign-in failed</strong>
            <p>{loginMutation.error.message}</p>
          </div>
        ) : null}

        <button
          className="primary-button button-full"
          style={{ minHeight: 44, fontSize: "0.95rem", marginTop: "0.25rem" }}
          disabled={loginMutation.isPending}
          type="submit"
        >
          <LogIn size={16} />
          {loginMutation.isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {/* Footer links */}
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
        Don&apos;t have an account?{" "}
        <Link className="text-link" href="/signup">
          Create an account
        </Link>
      </p>
    </section>
  );
}

function validateLoginForm(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};

  if (!email.trim()) {
    errors.email = "Enter the instructor email address for this account.";
  } else if (!emailPattern.test(email.trim())) {
    errors.email = "Enter a valid instructor email address.";
  }

  if (!password) {
    errors.password = "Enter your password to continue.";
  }

  return errors;
}
