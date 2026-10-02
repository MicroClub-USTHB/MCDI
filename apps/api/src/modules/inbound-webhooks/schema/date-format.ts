/**
 * Strict date parsing shared by both validation layers.
 *
 * `Date.parse` is not a validator: V8 rolls `2026-02-31` over into March and
 * accepts strings like "1" or "March 7".
 */
import { isISO8601, isRFC3339 } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in `YYYY-MM-DD`. */
export function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DATE_RE.test(value) &&
    isISO8601(value, { strict: true })
  );
}

/** An RFC 3339 date-time: a real calendar date, a `T`, and an explicit offset. */
export function isDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isRFC3339(value) &&
    isISO8601(value, { strict: true, strictSeparator: true })
  );
}
