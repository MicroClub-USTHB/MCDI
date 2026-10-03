import { RoleDetailView } from './role-detail-view';

export default async function ServerRolePage({
  params,
}: {
  params: Promise<{ id: string; roleId: string }>;
}) {
  const { id, roleId } = await params;
  return <RoleDetailView roleId={roleId} serverId={id} />;
}
