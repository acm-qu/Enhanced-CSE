import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MenuIcon } from 'lucide-react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { NavigationProgress } from '@/components/navigation-progress';
import { SearchCommand, SearchTrigger } from '@/components/search-command';
import { SupportChatBubble } from '@/components/support-chat/SupportChatBubble';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Enhanced CSE Platform',
    template: '%s | Enhanced CSE Platform'
  },
  description: 'Qatar University CSE knowledge and blog portal'
};

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/cs-study-plan', label: 'CS Study Plan' },
  { href: '/wiki', label: 'Wiki' },
  { href: '/posts', label: 'Blog' }
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
              <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                <nav className="hidden items-center gap-1 md:flex">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                  <SearchTrigger className="border-border/60 bg-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground" />
                  <ThemeToggle className="border-border text-foreground/80 hover:bg-foreground/5 hover:text-foreground data-[state=on]:bg-[#2CAD9E]/20 data-[state=on]:text-foreground" />

                  <div className="md:hidden">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full border-border bg-transparent text-foreground hover:bg-foreground/5 hover:text-foreground"
                        >
                          <MenuIcon className="h-4 w-4" />
                          <span className="sr-only">Open navigation menu</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[280px]">
                        <SheetHeader>
                          <SheetTitle className="text-left text-lg">Navigation</SheetTitle>
                        </SheetHeader>
                        <nav className="mt-6 flex flex-col gap-2">
                          {NAV_LINKS.map((link) => (
                            <Link key={link.href} href={link.href} className="top-nav-link justify-start">
                              {link.label}
                            </Link>
                          ))}
                        </nav>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>
            </header>

            {children}

            <footer className="mt-16 border-t border-white/10 bg-[#060606] text-white">
              <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
                <div>
                  <h3 className="mb-4 text-lg font-semibold">Platform</h3>
                  <p className="text-sm text-white/70">
                    Enhanced CSE Portal for synced wiki articles and blog content from Qatar University sources.
                  </p>
                </div>

                <div>
                  <h3 className="mb-4 text-lg font-semibold">Explore</h3>
                  <div className="space-y-2 text-sm text-white/80">
                    <Link href="/" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Home
                    </Link>
                    <Link href="/wiki" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Wiki Articles
                    </Link>
                    <Link href="/posts" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Blog Posts
                    </Link>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-lg font-semibold">API</h3>
                  <div className="space-y-2 text-sm text-white/80">
                    <Link href="/api/v1/wiki/articles?page=1&pageSize=5" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Wiki Articles Endpoint
                    </Link>
                    <Link href="/api/v1/posts?page=1&pageSize=5" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Blog Posts Endpoint
                    </Link>
                    <Link href="/api/health" className="block transition-colors hover:text-[hsl(var(--brand-cyan-light))]">
                      Health Check
                    </Link>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 px-4 py-4 text-center text-xs tracking-[0.14em] text-white/50 sm:px-6">
                ENHANCED CSE PLATFORM
              </div>
            </footer>
          </div>

          <Toaster richColors position="bottom-right" />
          <NavigationProgress />
          <SearchCommand />
          <SupportChatBubble />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
