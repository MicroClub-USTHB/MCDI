'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { Fingerprint, Menu, X } from 'lucide-react';

import { DocsSidebar } from '@/features/docs/components/docs-sidebar';
import { API_REFERENCE_HREF } from '@/features/docs/links';
import { Button } from '@/shared/components/ui/button';

/**
 * The frame of every docs page: a top bar, the navigation (fixed beside the content from `md`,
 * a drawer below it) and the content area. The drawer is Radix Dialog, which traps focus, closes
 * on Escape and gives focus back to the button that opened it.
 */
export function DocsShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-surface-base text-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-body focus:text-on-brand"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface-base/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-2">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="rounded-md p-2 text-text-muted outline-none hover:bg-surface-hover hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus md:hidden"
                >
                  <Menu className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay md:hidden" />
                <Dialog.Content
                  aria-describedby={undefined}
                  className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-border bg-surface-base p-4 outline-none md:hidden"
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-heading text-text-primary">
                      Documentation navigation
                    </Dialog.Title>
                    <Dialog.Close
                      aria-label="Close navigation"
                      className="rounded-md p-2 text-text-muted outline-none hover:bg-surface-hover hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <DocsSidebar onNavigate={() => setOpen(false)} />
                  <a
                    href={API_REFERENCE_HREF}
                    className="rounded-md border-t border-border px-3 py-3 text-body text-text-muted outline-none hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    API reference
                  </a>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md text-heading text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-lg bg-brand-tint text-brand-light"
              >
                <Fingerprint className="size-4" />
              </span>
              MCDI
            </Link>
            <span className="hidden text-body text-text-subtle sm:inline">Docs</span>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href={API_REFERENCE_HREF}>API reference</a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Admin sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-border p-4 md:block">
          <DocsSidebar />
        </aside>
        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
