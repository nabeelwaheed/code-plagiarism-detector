import { AssignmentWorkspace } from "../../../../components/assignment-workspace";

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { assignmentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialTab = resolvedSearchParams?.tab === "pairs" ? "pairs" : "submissions";

  return <AssignmentWorkspace assignmentId={assignmentId} initialTab={initialTab} />;
}
