import { SyncRunView } from './sync-run-view';

export default async function ServerSyncRunPage({
  params,
}: {
  params: Promise<{ id: string; syncLogId: string }>;
}) {
  const { id, syncLogId } = await params;
  return <SyncRunView syncLogId={syncLogId} backHref={`/dashboard/servers/${id}/sync`} />;
}
