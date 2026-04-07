"use client";

import Link from "next/link";

export function GlobalFooter() {
  return (
    <footer className="global-footer">
      <div className="footer-shell">
        <div className="footer-main">
          <strong className="footer-brand-name">Anti-Vibe Coder</strong>
          <span className="footer-description">Academic code review platform</span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link href="/">Student Submission</Link>
          <Link href="/login">Instructor Access</Link>
        </nav>

        <div className="footer-support">
          <span>Need help? Contact your instructor or course staff.</span>
        </div>

        <div className="footer-meta">
          <span>&copy; {new Date().getFullYear()} Anti-Vibe Coder</span>
        </div>
      </div>
    </footer>
  );
}
