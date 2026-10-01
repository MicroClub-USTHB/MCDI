'use client';

import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/common';
import { MESSAGE_HISTORY_LIMIT } from '@/features/channels/types';
import type { MessageView } from '@/features/channels/api/mappers';

interface MessageHistoryProps {
  messages: MessageView[];
  hasMore: boolean;
  /** Whether a load has been requested yet — history is opt-in. */
  loaded: boolean;
  isLoading: boolean;
  isError: boolean;
  onLoad: () => void;
  onRetry: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Recent messages for the selected channel — loads on demand (issue AC: last 50). */
export function MessageHistory({
  messages,
  hasMore,
  loaded,
  isLoading,
  isError,
  onLoad,
  onRetry,
}: MessageHistoryProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-overline text-text-subtle uppercase">Message history</h3>
        {loaded && !isLoading && !isError && (
          <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
            Refresh
          </Button>
        )}
      </div>

      {!loaded ? (
        <Button type="button" variant="secondary" size="sm" onClick={onLoad} className="w-fit">
          Load recent messages
        </Button>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <LoadingSkeleton className="h-12 rounded-md" />
          <LoadingSkeleton className="h-12 rounded-md" />
          <LoadingSkeleton className="h-12 rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-body text-error">Couldn’t load the message history.</span>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : messages.length === 0 ? (
        <p className="text-body text-text-muted">No messages in this channel yet.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {messages.map((message) => (
              <li key={message.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="text-subhead text-text-primary">{message.authorName}</span>
                  <span className="text-overline text-text-faint">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                {message.content && (
                  <p className="whitespace-pre-wrap text-body text-text-normal">
                    {message.content}
                  </p>
                )}
                {message.embeds.map((embed, index) => (
                  <p
                    key={index}
                    className="border-l-2 border-border pl-2 text-body text-text-muted"
                  >
                    {embed.title ?? embed.description ?? 'Embed'}
                  </p>
                ))}
                {message.attachmentCount > 0 && (
                  <p className="text-overline text-text-faint">
                    {message.attachmentCount} attachment
                    {message.attachmentCount === 1 ? '' : 's'}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {hasMore && (
            <p className="text-overline text-text-faint">
              Showing the {MESSAGE_HISTORY_LIMIT} most recent — older messages aren’t shown.
            </p>
          )}
        </>
      )}
    </div>
  );
}
