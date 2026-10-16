'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Fingerprint, Menu, X } from 'lucide-react';

import { DocsSidebar } from '@/features/docs/components/docs-sidebar';
import { API_REFERENCE_HREF } from '@/features/docs/links';
import { ThemeToggle } from '@/shared/components/common/ThemeToggle';
import { McButton, buttonVariants } from '@/shared/components/ui/mc-button';
import {
  McDialog,
  McDialogClose,
  McDialogContent,
  McDialogTitle,
  McDialogTrigger,
} from '@/shared/components/ui/mc-dialog';
import { cn } from '@/shared/lib/utils';

/**
 * The frame of every docs page: a top bar, the navigation (fixed beside the content from `md`,
 * a drawer below it) and the content area. The drawer is McDialog (Base UI), which traps focus, closes
 * on Escape and gives focus back to the button that opened it.
 */
export function DocsShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:paragraph-sm focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-2">
            <McDialog open={open} onOpenChange={setOpen}>
              <McDialogTrigger
                render={
                  <McButton
                    variant="tertiary"
                    size="sm"
                    icon="only"
                    iconDefinition={<Menu aria-hidden="true" />}
                    className="md:hidden"
                  >
                    Open navigation
                  </McButton>
                }
              />
              <McDialogContent
                showCloseButton={false}
                className="top-0 left-0 flex h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto rounded-none border-0 border-r border-border bg-background p-4 sm:min-h-0 md:hidden data-open:zoom-in-100 data-closed:zoom-out-100"
              >
                <div className="flex items-center justify-between">
                  <McDialogTitle className="paragraph-md font-semibold text-foreground">
                    Documentation navigation
                  </McDialogTitle>
                  <McDialogClose
                    render={
                      <McButton
                        variant="tertiary"
                        size="sm"
                        icon="only"
                        iconDefinition={<X aria-hidden="true" />}
                      >
                        Close navigation
                      </McButton>
                    }
                  />
                </div>
                <DocsSidebar onNavigate={() => setOpen(false)} />
                <a
                  href={API_REFERENCE_HREF}
                  className="rounded-md border-t border-border px-3 py-3 paragraph-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  API reference
                </a>
              </McDialogContent>
            </McDialog>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md paragraph-md font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"
              >
                <Fingerprint className="size-4" />
              </span>
              MCID
            </Link>
            <span className="hidden paragraph-sm text-muted-foreground sm:inline">Docs</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={API_REFERENCE_HREF}
              className={cn(
                buttonVariants({ variant: 'tertiary', size: 'sm' }),
                'hidden bg-transparent sm:inline-flex'
              )}
            >
              API reference
            </a>
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Admin sign in
            </Link>
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
