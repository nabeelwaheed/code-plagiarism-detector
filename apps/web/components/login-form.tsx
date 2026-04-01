"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { login } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";

export function LoginForm() {
  const router = useRouter();
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

    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/student");
  }, [currentUserQuery.data, router]);

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (session) => {
      router.push(session.role === "professor" ? "/professor" : "/student");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
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
      <button className="primary-button" disabled={loginMutation.isPending} type="submit">
        {loginMutation.isPending ? "Signing in..." : "Sign in"}
      </button>
      {loginMutation.error ? (
        <p className="error-text">{loginMutation.error.message}</p>
      ) : null}
    </form>
  );
}
