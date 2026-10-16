import '@testing-library/jest-dom';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

configure({ asyncUtilTimeout: 5000 });

// Toasts go to a recorder instead of the Sonner toaster; see tests/helpers/toasts.ts.
vi.mock('@/shared/stores/toast', async () => {
  const { recordToast } = await import('./helpers/toasts');
  return { showToast: recordToast };
});

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
  // Unmount first: components subscribe to the auth store through `useCan`, and resetting the store
  // under a mounted tree would re-render it (and re-run its effects) after the test has ended.
  cleanup();
  server.resetHandlers();
  const { shownToasts } = await import('./helpers/toasts');
  shownToasts.length = 0;
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
// jsdom has no pointer capture. Base UI and the vaul drawer behind mc-drawer call these.
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
