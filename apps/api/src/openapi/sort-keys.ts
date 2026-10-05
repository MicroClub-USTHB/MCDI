/**
 * The same value with every object's keys in alphabetical order (arrays keep their order), so the
 * exported file does not change just because a decorator moved.
 */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value))
    return (value as unknown[]).map((item) => sortKeys(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortKeys(item)]),
    ) as T;
  }
  return value;
}
