'use client';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McCard, McCardContent } from '@/shared/components/ui/mc-card';
import type { MemberDetail } from '@/features/members/types';
import { MemberAvatar } from './MemberAvatar';

interface MemberProfileCardProps {
  member: MemberDetail;
}

export function MemberProfileCard({ member }: MemberProfileCardProps) {
  const displayName = member.displayName || member.globalName || member.username;

  return (
    <McCard>
      <McCardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <MemberAvatar
            displayName={displayName}
            avatarUrl={member.avatarUrl}
            avatarInitials={member.avatarInitials}
            sizeClassName="size-20"
            textSizeClassName="text-lg"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="header-xs font-bold text-foreground">{displayName}</h1>
              {member.isClubMember ? <McBadge variant="secondary">Club member</McBadge> : null}
            </div>
            <p className="paragraph-sm text-muted-foreground">
              @{member.username}
              {member.globalName ? ` · ${member.globalName}` : ''}
            </p>
            <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
              Discord ID: {member.memberId}
            </p>
          </div>
        </div>
      </McCardContent>
    </McCard>
  );
}
