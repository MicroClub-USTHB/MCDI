'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Menu, Search } from 'lucide-react';

import { ThemeToggle } from '@/shared/components/common/ThemeToggle';
import { Breadcrumb } from '@/shared/components/layout/breadcrumb';
import { AppSidebar, MobileSidebar } from '@/shared/components/layout/sidebar';
import { useBreadcrumbItems } from '@/shared/components/layout/use-breadcrumb-items';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import {
  McSidebarInset,
  McSidebarProvider,
  McSidebarTrigger,
} from '@/shared/components/ui/mc-sidebar';

/**
 * The admin panel's frame. On desktop a floating mcoli-ui sidebar sits beside
 * the page and collapses to icons; below `md` it becomes a drawer opened from
 * the top bar's menu button. Only `<main>` scrolls, so the top bar stays put.
 */
function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const breadcrumbItems = useBreadcrumbItems();

  // Closing the drawer (backdrop, its close button or Escape) returns focus to the menu button.
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return (
    <McSidebarProvider className="h-svh min-h-0 overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <MobileSidebar open={mobileOpen} onClose={closeMobile} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
          <McButton
            ref={menuButtonRef}
            variant="tertiary"
            size="sm"
            icon="only"
            iconDefinition={<Menu aria-hidden="true" />}
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            aria-controls="dashboard-sidebar"
            aria-expanded={mobileOpen}
          >
            Open sidebar
          </McButton>
          <McSidebarTrigger className="hidden md:inline-flex" />
          <Breadcrumb items={breadcrumbItems} className="hidden min-w-0 flex-1 sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <McInput
              type="search"
              placeholder="Search..."
              aria-label="Search"
              addonStart={<Search aria-hidden="true" />}
              className="hidden w-64 lg:flex"
            />
            <ThemeToggle />
          </div>
        </header>
        <McSidebarInset id="main-content" className="p-4 md:p-6">
          {children}
        </McSidebarInset>
      </div>
    </McSidebarProvider>
  );
}

export { DashboardShell };
