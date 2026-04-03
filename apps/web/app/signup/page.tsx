import { ProfessorSignupForm } from "../../components/professor-signup-form";

export default function SignupPage() {
  return (
    <main className="page-shell narrow-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Professor Access</p>
          <h1>Create a professor account</h1>
          <p>
            Sign up for a professor account to create assignments, manage uploads, and review
            suspicious pairs.
          </p>
        </div>
      </section>
      <ProfessorSignupForm />
    </main>
  );
}
