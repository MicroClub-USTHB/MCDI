'use client';

import { Badge } from '@/shared/components/ui/badge';
import type { ChannelDetailView } from '@/features/channels/api/mappers';

interface ChannelDetailProps {
  channel: ChannelDetailView;
}

/** Name / topic / type / NSFW / permission overwrites for the selected channel. */
export function ChannelDetail({ channel }: ChannelDetailProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="paragraph-md font-semibold text-foreground">#{channel.name}</h2>
        <Badge variant="secondary">{channel.typeLabel}</Badge>
        {channel.nsfw && <Badge variant="warning">NSFW</Badge>}
        {channel.overwriteCount > 0 && (
          <Badge variant="secondary">
            {channel.overwriteCount} permission overwrite{channel.overwriteCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
      {channel.topic ? (
        <p className="paragraph-sm text-muted-foreground">{channel.topic}</p>
      ) : (
        <p className="paragraph-sm text-muted-foreground/70">No topic set.</p>
      )}
      <p className="font-mono paragraph-xs font-semibold tracking-wide text-muted-foreground">
        ID: {channel.id}
      </p>
    </div>
  );
}
