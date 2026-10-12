import { Container } from '@/components/landing/primitives';
import { Logo } from '@/components/layout/site-header';
import { McSeparator } from '@/components/ui/mc-separator';
import { MCDI_URL, MCOLI_URL, NAV_LINKS, REPO_URL } from '@/lib/site';

const linkClass = 'paragraph-sm text-muted-foreground transition-colors hover:text-foreground';

export function SiteFooter() {
  return (
    <footer className="bg-muted/40">
      <McSeparator />
      <Container className="flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo />
          <p className="paragraph-sm text-muted-foreground">
            The MCDI admin CLI for backends. Built by the MicroClub Dev Department.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:gap-20">
          <nav aria-label="Footer" className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground">On this page</p>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground">Project</p>
            <a href={REPO_URL} className={linkClass}>
              GitHub
            </a>
            <a href={MCDI_URL} className={linkClass}>
              MCDI
            </a>
            <a href={MCOLI_URL} className={linkClass}>
              mcoli-ui
            </a>
          </div>
        </div>
      </Container>
      <McSeparator />
      <Container className="py-6">
        <p className="paragraph-xs text-muted-foreground">MIT License · MicroClub USTHB</p>
      </Container>
    </footer>
  );
}
