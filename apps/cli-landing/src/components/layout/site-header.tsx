'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';

import { Container, GithubIcon } from '@/components/landing/primitives';
import { ModeToggle } from '@/components/theme/mode-toggle';
import { McButton } from '@/components/ui/mc-button';
import {
  McDrawer,
  McDrawerClose,
  McDrawerContent,
  McDrawerTitle,
  McDrawerTrigger,
} from '@/components/ui/mc-drawer';
import {
  McNavigationMenu,
  McNavigationMenuItem,
  McNavigationMenuLink,
  McNavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/mc-navigation-menu';
import { McSeparator } from '@/components/ui/mc-separator';
import { NAV_LINKS, REPO_URL } from '@/lib/site';

export function Logo() {
  return (
    <Link href="/" aria-label="m-forge home" className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground"
      >
        &gt;_
      </span>
      <span className="font-mono text-base font-bold text-foreground">m-forge</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />

        {/* Desktop nav: mcoli-ui's "direct link styled as a trigger" pattern */}
        <McNavigationMenu aria-label="Main" className="hidden md:flex">
          <McNavigationMenuList>
            {NAV_LINKS.map((link) => (
              <McNavigationMenuItem key={link.href}>
                <McNavigationMenuLink
                  className={navigationMenuTriggerStyle()}
                  render={<a href={link.href}>{link.label}</a>}
                />
              </McNavigationMenuItem>
            ))}
          </McNavigationMenuList>
        </McNavigationMenu>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <ModeToggle />
          </div>
          <McButton
            nativeButton={false}
            size="sm"
            variant="secondary"
            icon="leading"
            iconDefinition={<GithubIcon />}
            className="hidden md:inline-flex"
            render={<a href={REPO_URL} target="_blank" rel="noopener noreferrer" />}
          >
            GitHub
          </McButton>

          {/* Mobile nav */}
          <McDrawer direction="right">
            <McDrawerTrigger asChild>
              <McButton variant="tertiary" size="sm" icon="only" iconDefinition={<Menu />} className="md:hidden">
                Open menu
              </McButton>
            </McDrawerTrigger>
            <McDrawerContent className="w-72 p-6">
              <McDrawerTitle className="mb-6">
                <Logo />
              </McDrawerTitle>
              <nav aria-label="Mobile" className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <McDrawerClose key={link.href} asChild>
                    <a href={link.href} className="rounded-lg px-3 py-3 paragraph-md text-foreground hover:bg-muted">
                      {link.label}
                    </a>
                  </McDrawerClose>
                ))}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-3 paragraph-md text-foreground hover:bg-muted"
                >
                  <GithubIcon /> GitHub
                </a>
              </nav>
              <McSeparator className="my-6" />
              <ModeToggle />
            </McDrawerContent>
          </McDrawer>
        </div>
      </Container>
    </header>
  );
}
