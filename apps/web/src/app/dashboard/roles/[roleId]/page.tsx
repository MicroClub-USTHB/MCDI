import { RoleDetailView } from '@/app/dashboard/roles/[roleId]/role-detail-view';

export default async function RolePage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<{ server?: string }>;
}) {
  const { roleId } = await params;
  const { server } = await searchParams;

  return <RoleDetailView roleId={roleId} serverId={server ?? ''} />;
}
