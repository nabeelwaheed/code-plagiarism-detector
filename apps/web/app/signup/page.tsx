import { ProfessorSignupForm } from "../../components/professor-signup-form";

export default function SignupPage() {
  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 1rem" }}>
      <ProfessorSignupForm />
    </main>
  );
}
