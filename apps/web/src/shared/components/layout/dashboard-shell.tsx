'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { Breadcrumb } from '@/shared/components/layout/breadcrumb';
import { Sidebar } from '@/shared/components/layout/sidebar';
import { useBreadcrumbItems } from '@/shared/components/layout/use-breadcrumb-items';
import { SearchInput } from '@/shared/components/ui/input';

/**
 * Owns the sidebar's open/closed state so the topbar's hamburger toggle and
 * the sidebar's own close controls stay in sync. Kept as a single client
 * boundary under the (server) `ProtectedRoute` wrapper in `layout.tsx`.
 *
 * The shell itself never scrolls (`h-screen overflow-hidden`) — only `<main>`
 * does. At md+ the sidebar and the topbar+main panel are two separate
 * floating cards inset from the shell's padding (each `rounded-2xl` and
 * bordered), matching a Discord-toned take on the reference dashboard
 * layout. Below md both go flush edge-to-edge — the standard mobile
 * pattern, and it keeps the slide-in drawer unaffected.
 *
 * `<main>` sits on `surface-base`, not `surface-main`: base and raised are
 * ~13-15/255 apart per channel, base and main only ~6-7 apart, so cards
 * (`surface-raised`) read as a clear lift off `surface-base` but nearly
 * blend into `surface-main`. This also puts cards on the same tone as the
 * header (`surface-raised`), so chrome and cards share one consistent
 * "raised" surface throughout the panel.
 */
function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const breadcrumbItems = useBreadcrumbItems();

  // Closing (via backdrop click, the sidebar's own close button, or Escape)
  // always returns focus to the trigger that opened it.
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return (
    <div className="flex h-screen gap-0 overflow-hidden bg-surface-base p-0 text-text-primary md:gap-3 md:p-3">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-body focus:text-on-brand"
      >
        Skip to main content
      </a>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-2xl md:border md:border-border">
        <header className="shrink-0 border-b border-border bg-surface-raised">
          <div className="flex h-topbar items-center gap-4 px-4">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-normal md:hidden"
              aria-label="Open sidebar"
              aria-controls="dashboard-sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="max-w-sm flex-1">
              <SearchInput placeholder="Search..." aria-label="Search" />
            </div>
          </div>
        </header>
        <main id="main-content" className="relative flex-1 overflow-y-auto bg-surface-base p-6">
          <Breadcrumb items={breadcrumbItems} className="mb-4" />
          {children}
        </main>
      </div>
    </div>
  );
}

export { DashboardShell };
