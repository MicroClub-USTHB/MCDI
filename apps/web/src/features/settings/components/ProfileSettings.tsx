'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import { MemberAvatar } from '@/features/members';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import type { AdminProfileDto, UpdateProfilePayload } from '@/features/settings/types';

interface ProfileSettingsProps {
  profile: AdminProfileDto;
  onSave: (payload: UpdateProfilePayload) => void;
  isSaving?: boolean;
}

function getInitials(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function getAvatarUrl(memberId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  const extension = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${memberId}/${avatar}.${extension}?size=64`;
}

function ProfileSettings({ profile, onSave, isSaving = false }: ProfileSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.preferredName ?? '');
  const [error, setError] = useState<string | undefined>();

  const displayName =
    profile.preferredName ?? profile.displayName ?? profile.globalName ?? profile.username;
  const isDirty = draftName.trim() !== (profile.preferredName ?? '');

  function startEditing() {
    setDraftName(profile.preferredName ?? '');
    setError(undefined);
    setIsEditing(true);
  }

  function handleSave() {
    const trimmed = draftName.trim();
    if (trimmed.length > 255) {
      setError('Must be at most 255 characters');
      return;
    }
    onSave({ preferredName: trimmed === '' ? null : trimmed });
    setIsEditing(false);
  }

  return (
    <SettingsSection
      title="Profile"
      icon={UserRound}
      description="Your admin display name. Everything else is synced from Discord."
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MemberAvatar
            displayName={displayName}
            avatarUrl={getAvatarUrl(profile.id, profile.avatar)}
            avatarInitials={getInitials(displayName)}
            sizeClassName="size-12"
            textSizeClassName="text-base"
          />
          <div>
            <p className="paragraph-sm font-medium text-foreground">{displayName}</p>
            <div className="mt-0.5 flex items-center gap-2 paragraph-xs text-muted-foreground">
              <span>@{profile.username}</span>
              {profile.isSystemAdmin ? <McBadge variant="secondary">System Admin</McBadge> : null}
            </div>
          </div>
        </div>
        {!isEditing && (
          <McButton type="button" variant="tertiary" size="sm" onClick={startEditing}>
            Edit name
          </McButton>
        )}
      </div>

      {isEditing && (
        <div className="flex flex-col gap-1.5">
          <McInput
            id="preferredName"
            label="Preferred name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Leave blank to use the Discord name"
            error={error}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <McButton type="button" size="sm" disabled={isSaving || !isDirty} onClick={handleSave}>
              Save
            </McButton>
            <McButton
              type="button"
              variant="tertiary"
              size="sm"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </McButton>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

export { ProfileSettings, type ProfileSettingsProps };
