import { MemberAccessView } from '@/app/dashboard/members/[discordId]/access/member-access-view';

export default async function MemberAccessPage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const { discordId } = await params;
  return <MemberAccessView memberId={discordId} />;
}
