import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Brock COSC 4P02</p>
          <h1>Similarity review with real uploads, workers, and evidence mapping</h1>
          <p>
            Students submit zip archives with an assignment keyID. Professors create assignments,
            upload historical and template material, and inspect suspicious GST matches in a live
            side-by-side viewer.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button as-link" href="/login">
            Login
          </Link>
        </div>
      </section>

      {process.env.NODE_ENV !== "production" ? (
        <section className="panel">
          <h2>Seeded development accounts</h2>
          <ul className="compact-list">
            <li>Professor: `professor@example.com` / `professor123`</li>
            <li>Student: `student@example.com` / `student123`</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
