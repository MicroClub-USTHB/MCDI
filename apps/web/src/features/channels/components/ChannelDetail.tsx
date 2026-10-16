'use client';

import { McBadge } from '@/shared/components/ui/mc-badge';
import type { ChannelDetailView } from '@/features/channels/api/mappers';

interface ChannelDetailProps {
  channel: ChannelDetailView;
}

/** Name / topic / type / NSFW / permission overwrites for the selected channel. */
export function ChannelDetail({ channel }: ChannelDetailProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="header-xs font-bold text-foreground">#{channel.name}</h2>
        <McBadge variant="outline">{channel.typeLabel}</McBadge>
        {channel.nsfw && (
          <McBadge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
            NSFW
          </McBadge>
        )}
        {channel.overwriteCount > 0 && (
          <McBadge variant="outline">
            {channel.overwriteCount} permission overwrite{channel.overwriteCount === 1 ? '' : 's'}
          </McBadge>
        )}
      </div>
      {channel.topic ? (
        <p className="paragraph-sm text-muted-foreground">{channel.topic}</p>
      ) : (
        <p className="paragraph-sm text-muted-foreground">No topic set.</p>
      )}
      <p className="font-mono paragraph-xs font-semibold tracking-wide text-muted-foreground">
        ID: {channel.id}
      </p>
    </div>
  );
}
