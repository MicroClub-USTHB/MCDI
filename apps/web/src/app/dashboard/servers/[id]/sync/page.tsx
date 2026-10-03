import { SyncView } from './sync-view';

export default async function ServerSyncPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SyncView serverId={id} />;
}
