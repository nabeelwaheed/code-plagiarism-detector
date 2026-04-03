"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signupProfessor } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

export function ProfessorSignupForm() {
  const router = useRouter();
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
      router.push("/professor");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    setValidationError(null);
    signupMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="panel form-stack">
      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
        />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
        />
      </label>
      <button className="primary-button" disabled={signupMutation.isPending} type="submit">
        {signupMutation.isPending ? "Creating account..." : "Create professor account"}
      </button>
      {validationError ? <p className="error-text">{validationError}</p> : null}
      {signupMutation.error ? <p className="error-text">{signupMutation.error.message}</p> : null}
      <p className="muted-text">
        Already have an account?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
