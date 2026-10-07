import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

configure({ asyncUtilTimeout: 5000 });

const env = process.env as Record<string, string>;
env['NEXT_PUBLIC_API_URL'] = 'http://localhost:3000/api';
env['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3002';
env['NODE_ENV'] = 'test';

const handlers = [
  http.get('https://example.com/api/test', () => {
    return HttpResponse.json({ data: 'test' });
  }),
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
afterEach(async () => {
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();

  const { useAuthStore } = await import('@/features/auth/stores/auth');
  useAuthStore.persist.clearStorage();
  useAuthStore.setState({
    user: null,
    sessionExpiresAt: null,
    isAuthenticated: false,
    hasHydrated: false,
  });
});

// Feature tests render with full access. A test that needs a limited or an anonymous user says so
// with `signInAs({ permissions })` or `signOut()` from `tests/helpers/auth.ts`.
beforeEach(async () => {
  const { signInAsRoot } = await import('./helpers/auth');
  signInAsRoot();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock;

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
// Radix primitives (Select, etc.) probe this; jsdom doesn't implement it.
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
