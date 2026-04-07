import { PairViewerPanel } from "../../../../../../components/pair-viewer-panel";

export default async function PairViewerPage({
  params,
}: {
  params: Promise<{ pairId: string }>;
}) {
  const { pairId } = await params;

  return <PairViewerPanel pairId={pairId} />;
}
