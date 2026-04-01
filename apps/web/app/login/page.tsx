import { LoginForm } from "../../components/login-form";

export default function LoginPage() {
  return (
    <main className="page-shell narrow-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Seeded / Manual Auth</p>
          <h1>Role-based sign in</h1>
          <p>
            Sign in with a seeded account. Professor accounts go to assignment management and
            evidence review, while student accounts open the zip submission workflow.
          </p>
        </div>
      </section>
      <LoginForm />
    </main>
  );
}
