import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, CircleHelp } from "lucide-react";

type GuideItem = {
  title: string;
  body: string;
  bullets?: readonly string[];
};

type GuideSection = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  items: readonly GuideItem[];
};

export function HelpGuidePage({
  title,
  intro,
  backHref,
  backLabel,
  sections,
}: {
  title: string;
  intro: string;
  backHref: string;
  backLabel: string;
  sections: readonly GuideSection[];
}) {
  return (
    <main className="page-shell" style={{ maxWidth: 920, paddingTop: "1.5rem" }}>
      <div
        className="glass-card animate-fade-in"
        style={{ padding: "1.25rem", marginBottom: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <Link
            href={backHref}
            className="btn btn-outline btn-sm"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="btn btn-outline btn-sm"
                style={{ textDecoration: "none" }}
              >
                <ArrowDown size={14} />
                {section.badge}
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.7rem" }}>
          <CircleHelp size={18} color="var(--brand)" />
          <span
            style={{
              fontSize: "0.77rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--brand)",
            }}
          >
            Help Guide
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(1.55rem, 3vw, 2rem)", marginBottom: "0.5rem" }}>{title}</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", maxWidth: 720 }}>
          {intro}
        </p>

        <div
          className="alert alert-info"
          style={{ marginTop: "1rem", display: "grid", gap: "0.25rem" }}
        >
          <strong>How this guide is organized</strong>
          <span>
            The top section covers what users see and do. The second section explains technical
            behavior and system expectations.
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className="glass-card animate-fade-in"
            style={{ padding: "1.25rem", scrollMarginTop: "5.5rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.9rem",
                flexWrap: "wrap",
                marginBottom: "1rem",
                paddingBottom: "0.95rem",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <span
                  className="status-badge"
                  style={{
                    background: index === 0 ? "var(--brand-soft)" : "var(--bg-surface-raised)",
                    color: index === 0 ? "var(--brand)" : "var(--text-secondary)",
                    marginBottom: "0.65rem",
                  }}
                >
                  {section.badge}
                </span>
                <h2 style={{ fontSize: "1.15rem", marginBottom: "0.2rem" }}>{section.title}</h2>
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.88rem" }}>
                  {section.subtitle}
                </p>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.86rem",
                    maxWidth: 680,
                    marginTop: "0.35rem",
                  }}
                >
                  {section.description}
                </p>
              </div>

              <a
                href={`#${sections[(index + 1) % sections.length]?.id ?? section.id}`}
                className="btn btn-outline btn-sm"
                style={{ textDecoration: "none" }}
              >
                {index === 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                {index === 0 ? "Jump to Technical" : "Back to Visual"}
              </a>
            </div>

            <div style={{ display: "grid", gap: "0.85rem" }}>
              {section.items.map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: "0.95rem 1rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface-raised)",
                    border: "1px solid rgba(148, 163, 184, 0.12)",
                  }}
                >
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>{item.title}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>{item.body}</p>
                  {item.bullets && item.bullets.length > 0 && (
                    <ul
                      style={{
                        marginTop: "0.55rem",
                        paddingLeft: "1.15rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.86rem",
                      }}
                    >
                      {item.bullets.map((bullet) => (
                        <li key={bullet} style={{ marginTop: "0.2rem" }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
