import { AssignmentWorkspace } from "../../../../components/assignment-workspace";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  return (
    <main className="page-shell">
      <AssignmentWorkspace assignmentId={assignmentId} />
    </main>
  );
}
