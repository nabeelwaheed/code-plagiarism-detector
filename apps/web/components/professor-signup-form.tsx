"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, BookOpen, UserPlus } from "lucide-react";
import { signupProfessor } from "../lib/api";
import { useCurrentUserQuery } from "./auth-hooks";
import { useToast } from "./toast";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function calcPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthLabelClass = ["", "pw-label-1", "pw-label-2", "pw-label-3", "pw-label-4"];

function PasswordStrength({ password }: { password: string }) {
  const level = calcPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="pw-strength">
      <div className="pw-strength-track">
        <div className={`pw-strength-bar level-${level}`} />
      </div>
      <span className={`pw-strength-label ${strengthLabelClass[level]}`}>
        {strengthLabels[level]}
      </span>
    </div>
  );
}

export function ProfessorSignupForm() {
  const router = useRouter();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const currentUserQuery = useCurrentUserQuery();

  useEffect(() => {
    if (!currentUserQuery.data) return;
    router.replace(currentUserQuery.data.role === "professor" ? "/professor" : "/");
  }, [currentUserQuery.data, router]);

  const signupMutation = useMutation({
    mutationFn: () =>
      signupProfessor({
        email,
        password,
        firstName,
        lastName,
        title,
        department,
      }),
    onSuccess: () => {
      showToast("Account created. You can now create assignments.", "success");
      router.push("/professor");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);

    const nextErrors = validateSignupForm({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });

    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    signupMutation.mutate();
  };

  return (
    <section className="auth-card auth-card-signup fade-up">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 40,
            borderRadius: "10px",
            background: "var(--brand)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
          }}
        >
          <BookOpen size={20} strokeWidth={2} />
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.18rem" }}>
            Instructor Access
          </p>
          <h1
            style={{
              fontSize: "1.22rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Create Account
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
            }}
          >
            Set up your instructor account to start reviewing submissions.
          </p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} style={{ display: "grid", gap: "0.55rem" }}>
        {attemptedSubmit && Object.values(fieldErrors).some(Boolean) ? (
          <div className="validation-summary" role="alert">
            <strong>Please review the account details below.</strong>
            <ul>
              {Object.values(fieldErrors)
                .filter(Boolean)
                .map((message) => (
                  <li key={message}>{message}</li>
                ))}
            </ul>
          </div>
        ) : null}

        <div className="split-grid">
          <div className="field">
            <label className="field-label" htmlFor="first-name">
              First Name <span className="required-mark">*</span>
            </label>
            <input
              id="first-name"
              aria-describedby={fieldErrors.firstName ? "signup-first-name-error" : undefined}
              aria-invalid={Boolean(fieldErrors.firstName)}
              className={`input-control${fieldErrors.firstName ? " is-invalid" : ""}`}
              value={firstName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setFirstName(nextValue);

                if (attemptedSubmit) {
                  setFieldErrors(
                    validateSignupForm({
                      firstName: nextValue,
                      lastName,
                      email,
                      password,
                      confirmPassword,
                    }),
                  );
                }
              }}
              autoComplete="given-name"
              placeholder="e.g. Sarah"
            />
            {fieldErrors.firstName ? (
              <p className="field-error" id="signup-first-name-error">
                {fieldErrors.firstName}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="last-name">
              Last Name <span className="required-mark">*</span>
            </label>
            <input
              id="last-name"
              aria-describedby={fieldErrors.lastName ? "signup-last-name-error" : undefined}
              aria-invalid={Boolean(fieldErrors.lastName)}
              className={`input-control${fieldErrors.lastName ? " is-invalid" : ""}`}
              value={lastName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setLastName(nextValue);

                if (attemptedSubmit) {
                  setFieldErrors(
                    validateSignupForm({
                      firstName,
                      lastName: nextValue,
                      email,
                      password,
                      confirmPassword,
                    }),
                  );
                }
              }}
              autoComplete="family-name"
              placeholder="e.g. Chen"
            />
            {fieldErrors.lastName ? (
              <p className="field-error" id="signup-last-name-error">
                {fieldErrors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label className="field-label" htmlFor="prof-title">
              Title <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span>
            </label>
            <select
              id="prof-title"
              className="select-control"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            >
              <option value="">Select...</option>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Lecturer">Lecturer</option>
              <option value="Instructor">Instructor</option>
              <option value="Teaching Assistant">Teaching Assistant</option>
              <option value="Dr.">Dr.</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="department">
              Department <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="department"
              className="input-control"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              autoComplete="organization"
              placeholder="e.g. Computer Science"
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">
            Email Address <span className="required-mark">*</span>
          </label>
          <input
            id="email"
            aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            className={`input-control${fieldErrors.email ? " is-invalid" : ""}`}
            value={email}
            onChange={(event) => {
              const nextValue = event.target.value;
              setEmail(nextValue);

              if (attemptedSubmit) {
                setFieldErrors(
                  validateSignupForm({
                    firstName,
                    lastName,
                    email: nextValue,
                    password,
                    confirmPassword,
                  }),
                );
              }
            }}
            type="email"
            autoComplete="email"
            placeholder="instructor@university.edu"
          />
          {fieldErrors.email ? (
            <p className="field-error" id="signup-email-error">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password <span className="required-mark">*</span>
          </label>
          <div className="input-wrap">
            <input
              id="password"
              aria-describedby={fieldErrors.password ? "signup-password-error" : "signup-password-hint"}
              aria-invalid={Boolean(fieldErrors.password)}
              className={`input-control has-suffix${fieldErrors.password ? " is-invalid" : ""}`}
              value={password}
              onChange={(event) => {
                const nextValue = event.target.value;
                setPassword(nextValue);

                if (attemptedSubmit) {
                  setFieldErrors(
                    validateSignupForm({
                      firstName,
                      lastName,
                      email,
                      password: nextValue,
                      confirmPassword,
                    }),
                  );
                }
              }}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Choose a strong password"
            />
            <button
              className="input-suffix-btn"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <PasswordStrength password={password} />
          {fieldErrors.password ? (
            <p className="field-error" id="signup-password-error">
              {fieldErrors.password}
            </p>
          ) : (
            <p className="field-hint" id="signup-password-hint">
              Use at least 8 characters. Longer passwords with mixed character types work best.
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirm-password">
            Confirm Password <span className="required-mark">*</span>
          </label>
          <div className="input-wrap">
            <input
              id="confirm-password"
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "signup-confirm-password-error"
                  : "signup-confirm-password-hint"
              }
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              className={`input-control has-suffix${fieldErrors.confirmPassword ? " is-invalid" : ""}`}
              value={confirmPassword}
              onChange={(event) => {
                const nextValue = event.target.value;
                setConfirmPassword(nextValue);

                if (attemptedSubmit) {
                  setFieldErrors(
                    validateSignupForm({
                      firstName,
                      lastName,
                      email,
                      password,
                      confirmPassword: nextValue,
                    }),
                  );
                }
              }}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />
            <button
              className="input-suffix-btn"
              type="button"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={() => setShowConfirm((value) => !value)}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.confirmPassword ? (
            <p className="field-error" id="signup-confirm-password-error">
              {fieldErrors.confirmPassword}
            </p>
          ) : confirmPassword && password === confirmPassword ? (
            <p className="field-success" id="signup-confirm-password-hint">
              Passwords match.
            </p>
          ) : (
            <p className="field-hint" id="signup-confirm-password-hint">
              Re-enter the same password to confirm the account setup.
            </p>
          )}
        </div>

        {signupMutation.error ? (
          <div className="error-panel">
            <strong>Account creation failed</strong>
            <p>{signupMutation.error.message}</p>
          </div>
        ) : null}

        <button
          className="primary-button button-full"
          style={{ minHeight: 39, fontSize: "0.88rem", marginTop: "0.1rem" }}
          disabled={signupMutation.isPending}
          type="submit"
        >
          <UserPlus size={15} />
          {signupMutation.isPending ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        Already have an account?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}

function validateSignupForm(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const errors: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  } = {};

  if (!input.firstName.trim()) {
    errors.firstName = "Enter the instructor's first name.";
  }

  if (!input.lastName.trim()) {
    errors.lastName = "Enter the instructor's last name.";
  }

  if (!input.email.trim()) {
    errors.email = "Enter the university email address for this account.";
  } else if (!emailPattern.test(input.email.trim())) {
    errors.email = "Enter a valid email address for this account.";
  }

  if (!input.password) {
    errors.password = "Create a password before continuing.";
  } else if (calcPasswordStrength(input.password) < 2) {
    errors.password = "Choose a stronger password with at least 8 characters.";
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "Re-enter the password to confirm it.";
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = "The confirmation password does not match.";
  }

  return errors;
}
