import { ProfessorDashboard } from "../../components/professor-dashboard";

export default async function ProfessorPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return <ProfessorDashboard successMessage={params?.message ?? null} />;
}
