import { SyncRunView } from '@/app/dashboard/servers/[id]/sync/logs/[syncLogId]/sync-run-view';

/** Old run links have no server in them; a run is found by its ID alone, so it still opens here. */
export default async function SyncRunPage({ params }: { params: Promise<{ syncLogId: string }> }) {
  const { syncLogId } = await params;
  return <SyncRunView syncLogId={syncLogId} backHref="/dashboard/sync" />;
}
