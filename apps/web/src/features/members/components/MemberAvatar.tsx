'use client';

import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

interface MemberAvatarProps {
  displayName: string;
  avatarUrl: string | null;
  avatarInitials: string;
  sizeClassName?: string;
  textSizeClassName?: string;
  className?: string;
}

export function MemberAvatar({
  displayName,
  avatarUrl,
  avatarInitials,
  sizeClassName = 'size-10',
  textSizeClassName = 'text-sm',
  className,
}: MemberAvatarProps) {
  const [imageErrorUrl, setImageErrorUrl] = useState<string | null>(null);

  const shouldShowImage = Boolean(avatarUrl) && imageErrorUrl !== avatarUrl;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-brand text-center text-on-brand',
        sizeClassName,
        className
      )}
    >
      {shouldShowImage && avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${displayName} avatar`}
          className="size-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImageErrorUrl(avatarUrl)}
        />
      ) : (
        <span className={cn('font-semibold', textSizeClassName)}>{avatarInitials}</span>
      )}
    </div>
  );
}
