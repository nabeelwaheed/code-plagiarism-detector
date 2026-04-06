import { ProfessorDashboard } from "../../components/professor-dashboard";

export default async function ProfessorPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page-shell">
      <ProfessorDashboard successMessage={params?.message ?? null} />
    </main>
  );
}
