import { MemberAvatar } from '@/features/members/components/MemberAvatar';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return letters.map((part) => part?.[0]?.toUpperCase() ?? '').join('') || '?';
}

/** A member's avatar, name and username, for lists and page headers. */
export function MemberChip({
  displayName,
  username,
  avatar,
}: {
  displayName: string;
  username: string;
  avatar: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar
        displayName={displayName}
        avatarUrl={avatar}
        avatarInitials={initials(displayName)}
      />
      <div className="min-w-0">
        <div className="truncate paragraph-sm font-semibold text-foreground">{displayName}</div>
        <div className="truncate paragraph-xs font-semibold tracking-wide text-muted-foreground/70">
          @{username}
        </div>
      </div>
    </div>
  );
}
