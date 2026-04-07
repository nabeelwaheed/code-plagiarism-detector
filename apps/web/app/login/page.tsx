import { LoginForm } from "../../components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 1rem" }}>
      {params?.message === "account-deleted" && (
        <div className="alert alert-info" style={{ maxWidth: 420, margin: "0 auto 1rem" }}>
          Your professor account was deleted successfully.
        </div>
      )}
      <LoginForm />
    </main>
  );
}
