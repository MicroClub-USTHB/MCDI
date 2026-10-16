import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import '@/shared/styles/globals.css';
import { Providers } from '@/app/providers';
import { env } from '@/shared/lib/env';
import { cn } from '@/shared/lib/utils';

const plusJakartaSansPlusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
});

const dmSansDmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: 'MCID',
    template: '%s | MCID',
  },
  description: 'MCID Application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(dmSansDmSans.variable, plusJakartaSansPlusJakartaSans.variable)}>
      <body
        className={`${dmSansDmSans.variable} ${jetbrainsMono.variable} min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
