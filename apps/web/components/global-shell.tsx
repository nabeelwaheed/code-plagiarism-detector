"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, CircleHelp, LogOut } from "lucide-react";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";

export function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const session = currentUserQuery.data ?? null;

  const isPairReview = pathname.includes("/pairs/");
  const isAssignmentWorkspace =
    pathname.startsWith("/professor/assignments/") && !isPairReview;
  const isFullScreen = isPairReview || isAssignmentWorkspace;

  const isProfessorRoute = pathname.startsWith("/professor");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isPublicSubmissionRoute = pathname === "/";

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.href = "/login";
      },
    });
  };

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <header className="global-header">
        <Link href="/" className="global-header-brand">
          <div className="global-logo-badge" aria-hidden="true">
            <BookOpen size={17} strokeWidth={2.15} />
          </div>
          <div className="global-header-brand-copy">
            <div className="global-header-title">Anti-Vibe Coder</div>
            <div className="global-header-subtitle">Academic Integrity Platform</div>
          </div>
        </Link>

        <nav className="global-header-nav" aria-label="Primary">
          {isProfessorRoute ? (
            <>
              {pathname !== "/professor/help" ? (
                <Link href="/professor/help" className="global-header-link">
                  <CircleHelp size={13} />
                  Instructor Guide
                </Link>
              ) : null}
              <Link href="/" className="global-header-link">
                <ArrowLeft size={13} />
                Student Portal Access
              </Link>
              {session?.role === "professor" ? (
                <button
                  className="global-header-link"
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut size={13} />
                  {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                </button>
              ) : null}
            </>
          ) : isAuthRoute ? (
            <Link href="/" className="global-header-link">
              <ArrowLeft size={13} />
              Student Portal Access
            </Link>
          ) : (
            <>
              {isPublicSubmissionRoute ? (
                <Link href="/help/student" className="global-header-link">
                  <CircleHelp size={13} />
                  Submission Guide
                </Link>
              ) : null}
              <Link
                href={session?.role === "professor" ? "/professor" : "/login"}
                className="global-header-link global-header-link-primary"
              >
                Instructor Access
              </Link>
            </>
          )}
        </nav>
      </header>

      <div className="main-content">{children}</div>

      <footer className="global-footer">
        <span>&copy; {new Date().getFullYear()} Anti-Vibe Coder. All rights reserved.</span>
        <div className="global-footer-links">
          <Link href="/login">Instructor Login</Link>
          <Link href="/signup">Create Account</Link>
        </div>
      </footer>
    </div>
  );
}
