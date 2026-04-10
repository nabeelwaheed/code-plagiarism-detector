"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const currentUserQuery = useCurrentUserQuery();

  useEffect(() => {
    if (!currentUserQuery.data) return;
    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/");
  }, [currentUserQuery.data, router]);

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (session) => {
      router.push(session.role === "professor" ? "/professor" : "/");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{ maxWidth: 420, margin: "0 auto", padding: "2rem" }}
    >
      {/* Header */}
      <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>Instructor Sign In</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Manage assignments, upload material, and review suspicious pairs.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <div className="input-with-icon" style={{ position: "relative" }}>
            <Mail />
            <input
              id="login-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <div className="input-with-icon" style={{ position: "relative" }}>
            <Lock />
            <input
              id="login-password"
              className="form-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              style={{ paddingRight: "2.8rem" }}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="input-suffix-btn"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          disabled={loginMutation.isPending}
          type="submit"
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          {loginMutation.isPending ? "Signing in..." : "Sign In"}
        </button>

        {loginMutation.error && (
          <div className="alert alert-error">
            {loginMutation.error.message}
          </div>
        )}
      </form>

      <hr className="divider" style={{ margin: "1.25rem 0" }} />

      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Need an account?{" "}
        <Link href="/signup" className="text-brand" style={{ fontWeight: 600 }}>
          Create a professor account
        </Link>
      </p>
    </div>
  );
}