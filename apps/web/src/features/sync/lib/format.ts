const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "3 hours ago" / "in 2 minutes" from an ISO timestamp, or `null` when there's nothing to format. */
export function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return null;

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);

  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds || unit === 'second') {
      return relativeFormatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return null;
}

/** "12 Aug 2026, 14:30" from an ISO timestamp, matching the audit-log format used elsewhere. */
export function formatAbsoluteTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** "1m 12s" / "4.3s" / "820ms" from a millisecond span, or `null` when unknown. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}
