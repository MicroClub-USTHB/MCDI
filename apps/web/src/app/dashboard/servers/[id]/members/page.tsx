import { MembersView } from '@/app/dashboard/members/members-view';

export default async function ServerMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MembersView serverId={id} />;
}
