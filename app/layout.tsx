import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Enhanced CSE Platform',
    template: '%s | Enhanced CSE Platform'
  },
  description: 'Custom frontend and backend for synced CSE wiki and blog content'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur">
              <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2">
                  <Badge variant="default" className="text-[9px]">CSE</Badge>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                    CSE Wiki
                  </span>
                </Link>

                <nav className="ml-4 hidden items-center gap-1 sm:flex">
                  <Link href="/" className="top-nav-link">
                    Home
                  </Link>
                  <Link href="/wiki" className="top-nav-link">
                    Wiki
                  </Link>
                  <Link href="/posts" className="top-nav-link">
                    Blog
                  </Link>
                </nav>

                <div className="ml-auto flex items-center gap-2">
                  <Link
                    href="/wiki"
                    className="hidden h-9 items-center rounded-md border border-foreground/20 bg-foreground/10 px-3 text-xs text-foreground/70 sm:flex"
                  >
                    Search documentation...
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </header>

            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
