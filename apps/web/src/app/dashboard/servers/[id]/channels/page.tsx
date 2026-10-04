import { ChannelsView } from './channels-view';

export default async function ServerChannelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChannelsView serverId={id} />;
}
