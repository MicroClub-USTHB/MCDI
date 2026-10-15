import { vi } from 'vitest';

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** Replaces `fetch` with a router keyed by "METHOD /path" (the path after the base URL's `/api`). */
export function fakeMcid(routes: Record<string, Handler>): void {
  vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const key = `${init.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`;
    const handler = routes[key];
    if (!handler) return new Response('not found', { status: 404 });
    return handler(url, init);
  });
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
