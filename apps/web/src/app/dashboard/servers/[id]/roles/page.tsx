import { RolesView } from './roles-view';

export default async function ServerRolesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RolesView serverId={id} />;
}
