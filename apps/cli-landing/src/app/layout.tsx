import type { Metadata, Viewport } from 'next';
import { DM_Sans, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ThemeProvider } from '@/components/theme/theme-provider';
import McSonner from '@/components/ui/mc-sonner';
import { McTooltipProvider } from '@/components/ui/mc-tooltip';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';
import { cn } from '@/lib/utils';
import './globals.css';

// mcoli-ui's fonts: DM Sans for body text, Plus Jakarta Sans for headings. Code uses Geist Mono,
// the mono font `shadcn init` wires to --font-mono in globals.css.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
});
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

// Share previews need absolute URLs; set SITE_URL to the deployed address. An empty value counts as
// unset, but a malformed one fails the build with a readable message instead of a bare "Invalid URL".
function siteUrl(): URL {
  const value = process.env.SITE_URL?.trim() || 'http://localhost:3000';
  try {
    return new URL(value);
  } catch {
    throw new Error(
      'SITE_URL is not a valid URL. On Vercel it must be a Config variable: Secret values are not passed to the build.'
    );
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'm-forge',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      // next-themes sets the class before hydration, so the server markup legitimately differs.
      suppressHydrationWarning
      className={cn(
        'h-full antialiased motion-safe:scroll-smooth',
        dmSans.variable,
        plusJakartaSans.variable,
        geistMono.variable
      )}
    >
      <body className="flex min-h-full flex-col overflow-x-clip">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <McTooltipProvider>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </McTooltipProvider>
          <McSonner />
        </ThemeProvider>
      </body>
    </html>
  );
}
