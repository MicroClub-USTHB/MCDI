'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import type { MemberDetail } from '@/features/members/types';
import { MemberAvatar } from './MemberAvatar';

interface MemberProfileCardProps {
  member: MemberDetail;
}

export function MemberProfileCard({ member }: MemberProfileCardProps) {
  const displayName = member.displayName || member.globalName || member.username;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-0">
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
              <h1 className="paragraph-md font-semibold text-foreground">{displayName}</h1>
              {member.isClubMember ? <Badge variant="brand-light">Club member</Badge> : null}
            </div>
            <p className="paragraph-sm text-muted-foreground">
              @{member.username}
              {member.globalName ? ` · ${member.globalName}` : ''}
            </p>
            <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground/70">
              Discord ID: {member.memberId}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
