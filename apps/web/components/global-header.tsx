"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ArrowLeft, LogOut } from "lucide-react";
import { useCurrentUserQuery, useLogoutMutation } from "./auth-hooks";

export function GlobalHeader() {
  const pathname = usePathname();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const session = currentUserQuery.data ?? null;

  const isProfessorRoute = pathname.startsWith("/professor");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isPairReview = pathname.includes("/pairs/");

  if (isPairReview) return null;

  return (
    <header className="global-header">
      <Link href="/" className="header-brand">
        <div className="header-logo-mark" aria-hidden="true">
          <BookOpen size={16} strokeWidth={2} />
        </div>
        <div className="header-brand-label">
          <span className="header-brand-name">Anti-Vibe Coder</span>
          <span className="header-brand-sub">Academic Integrity</span>
        </div>
      </Link>

      <nav className="header-nav">
        {isProfessorRoute ? (
          <>
            <Link className="header-link" href="/">
              <ArrowLeft size={13} /> Student Portal
            </Link>
            {session?.role === "professor" ? (
              <button
                className="header-link"
                type="button"
                onClick={() => {
                  logoutMutation.mutate(undefined, {
                    onSettled: () => { window.location.href = "/login"; },
                  });
                }}
              >
                <LogOut size={13} /> Sign Out
              </button>
            ) : null}
          </>
        ) : isAuthRoute ? (
          <Link className="header-link" href="/">
            <ArrowLeft size={13} /> Student Portal
          </Link>
        ) : (
          <Link
            className="header-link header-link-primary"
            href={session?.role === "professor" ? "/professor" : "/login"}
          >
            Instructor Access
          </Link>
        )}
      </nav>
    </header>
  );
}
