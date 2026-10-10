import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Home, { metadata } from '@/app/page';
import { DOCS_HREF, LANDING } from '@/features/landing/content';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('Landing page', () => {
  it('has one h1, the headline', () => {
    render(<Home />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(LANDING.headline);
  });

  it('keeps the subtext short enough to read at a glance', () => {
    expect(LANDING.subtext.split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(LANDING.headline.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it('sends the docs button to the docs of this site', () => {
    expect(DOCS_HREF).toBe('/docs');
  });

  it('offers the docs first and the admin sign-in second, in the hero', () => {
    render(<Home />);
    const main = within(screen.getByRole('main'));

    const links = main.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      LANDING.docs.label,
      LANDING.signIn.label,
    ]);
    expect(links[0]).toHaveAttribute('href', DOCS_HREF);
    expect(links[1]).toHaveAttribute('href', '/login');
  });

  it('puts the admin sign-in in the navigation too, with the same label', () => {
    render(<Home />);

    const nav = within(screen.getByRole('navigation', { name: 'Primary' }));

    expect(nav.getByRole('link', { name: LANDING.signIn.label })).toHaveAttribute('href', '/login');
    expect(nav.getByRole('link', { name: LANDING.name })).toHaveAttribute('href', '/');
  });

  it('shows the admin panel with a description for screen readers', () => {
    render(<Home />);

    const image = screen.getByRole('img', { name: /admin panel/i });

    expect(image).toHaveAttribute('alt', LANDING.screenshot.alt);
    expect(image.getAttribute('src')).toContain('admin-panel');
  });

  it('lets keyboard users skip to the content', () => {
    render(<Home />);

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('uses no em or en dashes anywhere in its copy', () => {
    expect(strings(LANDING).filter((text) => /[–—]/.test(text))).toEqual([]);
  });

  it('sets a title and a description of a sensible length', () => {
    expect(metadata.title).toEqual({ absolute: LANDING.metadata.title });
    expect(metadata.description?.length).toBeGreaterThan(50);
    expect(metadata.description?.length).toBeLessThanOrEqual(160);
  });
});
