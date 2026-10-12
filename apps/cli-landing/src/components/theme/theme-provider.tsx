'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Light/dark is a `.dark` class on <html>, which is what the mcoli-ui theme CSS keys on.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
