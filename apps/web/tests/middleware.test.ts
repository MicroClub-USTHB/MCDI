import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, middleware } from '@/middleware';

const matcher = new RegExp(`^${config.matcher[0]}$`);

describe('middleware matcher', () => {
  it.each([
    '/landing/admin-panel.webp',
    '/images/logo.svg',
    '/photo.png',
    '/photo.jpg',
    '/photo.avif',
    '/favicon.ico',
    '/_next/static/chunks/app.js',
    '/_next/image',
  ])('leaves %s alone, so a logged-out visitor and the image optimizer can load it', (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(['/', '/login', '/dashboard', '/dashboard/projects/p1/inbound-webhooks'])(
    'still runs for the page %s',
    (path) => {
      expect(matcher.test(path)).toBe(true);
    }
  );
});

describe('middleware', () => {
  it('sends a logged-out visitor of a protected page to the login', () => {
    const response = middleware(new NextRequest('http://localhost:3002/dashboard/members'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3002/login?redirect=%2Fdashboard%2Fmembers'
    );
  });

  it('lets anyone see the landing page and the login', () => {
    for (const path of ['/', '/login']) {
      const response = middleware(new NextRequest(`http://localhost:3002${path}`));
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('lets a logged-out visitor read the docs', () => {
    for (const path of ['/docs', '/docs/start-here/what-is-mcdi', '/docs/build/contributing']) {
      const response = middleware(new NextRequest(`http://localhost:3002${path}`));
      expect(response.headers.get('location'), path).toBeNull();
    }
  });

  it('does not treat a look-alike path as the docs', () => {
    const response = middleware(new NextRequest('http://localhost:3002/docs-private'));

    expect(response.headers.get('location')).toBe(
      'http://localhost:3002/login?redirect=%2Fdocs-private'
    );
  });

  it('serves the sitemap to anyone, crawlers included', () => {
    const response = middleware(new NextRequest('http://localhost:3002/sitemap.xml'));

    expect(response.headers.get('location')).toBeNull();
  });
});
