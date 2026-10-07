'use client';

import Link from 'next/link';

import { MemberChip } from '@/features/access/components/MemberChip';
import type { OverrideMemberDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';

/** Every member who has overrides, with a summary and a link to their Access page. */
export function OverridesList({ members }: { members: OverrideMemberDto[] }) {
  if (members.length === 0) {
    return <p className="text-body text-text-muted">No member has an override.</p>;
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised">
      {members.map((member) => (
        <li key={member.memberId} className="border-b border-border last:border-b-0">
          <Link
            href={`/dashboard/members/${encodeURIComponent(member.memberId)}/access`}
            aria-label={`${member.displayName}, open Access`}
            className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between"
          >
            <MemberChip
              displayName={member.displayName}
              username={member.username}
              avatar={member.avatar}
            />
            <div className="flex flex-wrap items-center gap-2">
              {member.root ? <Badge variant="warning">Inactive while root</Badge> : null}
              {Object.entries(member.overrides).map(([resource, level]) => (
                <Badge key={resource} variant="outline">
                  {`${RESOURCE_TITLES[resource as keyof typeof RESOURCE_TITLES]}: ${level}`}
                </Badge>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
