/**
 * Converts an array of plain objects to a CSV string.
 * - Empty array → empty string.
 * - Values containing commas, double-quotes or newlines are quoted and
 *   internal double-quotes are escaped as `""` (RFC 4180).
 * - Objects and arrays are serialised with JSON.stringify before escaping.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);

  const escape = (val: unknown): string => {
    const str =
      val == null
        ? ''
        : typeof val === 'object'
          ? JSON.stringify(val)
          : String(val as string | number | boolean);

    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}
