import Link from "next/link";
import { LoginForm } from "../../components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page-shell narrow-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Professor Access</p>
          <h1>Professor sign in</h1>
          <p>
            Sign in to manage assignments, upload historical and template material, and review
            suspicious pairs. Student submission is now available from the public landing page.
          </p>
          <p className="muted-text">
            Need an account?{" "}
            <Link className="text-link" href="/signup">
              Create a professor account
            </Link>
          </p>
        </div>
      </section>
      {params?.message === "account-deleted" ? (
        <div className="alert alert-info">
          <p>Your professor account was deleted successfully.</p>
        </div>
      ) : null}
      <LoginForm />
    </main>
  );
}
