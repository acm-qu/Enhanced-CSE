import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MenuIcon } from 'lucide-react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { NavigationProgress } from '@/components/navigation-progress';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
          <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground">
              <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                  <Link href="/" className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-[9px] text-white hover:bg-blue-500">CSE</Badge>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                      CSE Wiki
                    </span>
                  </Link>

                  <Separator orientation="vertical" className="ml-2 h-5" />

                  <nav className="ml-2 hidden items-center gap-1 sm:flex">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/" className="top-nav-link">
                          Home
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Go to home</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/wiki" className="top-nav-link">
                          Wiki
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Browse wiki articles</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/posts" className="top-nav-link">
                          Blog
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Read blog posts</TooltipContent>
                    </Tooltip>
                  </nav>

                  <div className="ml-auto flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/wiki"
                          className="hidden h-9 w-48 items-center rounded-md border border-input bg-transparent px-3 text-xs text-muted-foreground hover:text-foreground sm:flex"
                        >
                          Search documentation...
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Search wiki articles</TooltipContent>
                    </Tooltip>

                    <Sheet>
                      <SheetTrigger asChild className="sm:hidden">
                        <Button variant="ghost" size="icon">
                          <MenuIcon className="h-4 w-4" />
                          <span className="sr-only">Open navigation menu</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left">
                        <SheetHeader>
                          <SheetTitle>Navigation</SheetTitle>
                        </SheetHeader>
                        <nav className="mt-4 flex flex-col gap-2">
                          <Link href="/" className="text-sm font-medium hover:underline">
                            Home
                          </Link>
                          <Link href="/wiki" className="text-sm font-medium hover:underline">
                            Wiki
                          </Link>
                          <Link href="/posts" className="text-sm font-medium hover:underline">
                            Blog
                          </Link>
                        </nav>
                      </SheetContent>
                    </Sheet>

                    <ThemeToggle />
                  </div>
                </div>
              </header>

              {children}
            </div>
          </TooltipProvider>
          <Toaster richColors position="bottom-right" />
          <NavigationProgress />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
