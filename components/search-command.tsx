'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { formatDate } from '@/lib/utils/date';

interface SearchResult {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  publishedAtGmt?: string | null;
  modifiedAtGmt?: string | null;
}

interface SearchResults {
  wiki: SearchResult[];
  posts: SearchResult[];
}

const OPEN_SEARCH_EVENT = 'open-search';

function buildMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' / ');
}

export function SearchTrigger({ className }: { className?: string }) {
  const open = () => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={open}
      className={className}
      aria-label="Open search"
    >
      <Search className="h-4 w-4" />
      <span className="ml-1.5 hidden sm:inline">Search</span>
      <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground sm:inline-flex">
        Ctrl
        <span>K</span>
      </kbd>
    </Button>
  );
}

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ wiki: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };

    const handleCustomEvent = () => setOpen(true);

    document.addEventListener('keydown', handleKeydown);
    window.addEventListener(OPEN_SEARCH_EVENT, handleCustomEvent);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener(OPEN_SEARCH_EVENT, handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ wiki: [], posts: [] });
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    setLoading(true);
    setHasSearched(false);

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: 'no-store'
        });

        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          setResults({ wiki: [], posts: [] });
          return;
        }

        const payload = (await response.json()) as Partial<SearchResults>;
        setResults({
          wiki: Array.isArray(payload.wiki) ? payload.wiki : [],
          posts: Array.isArray(payload.posts) ? payload.posts : []
        });
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        console.error('search.fetch_failed', error);
        setResults({ wiki: [], posts: [] });
      } finally {
        if (isMounted) {
          setLoading(false);
          setHasSearched(true);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setQuery('');
      setResults({ wiki: [], posts: [] });
      setLoading(false);
      setHasSearched(false);
    }
  };

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      setResults({ wiki: [], posts: [] });
      setLoading(false);
      setHasSearched(false);
      router.push(href);
    },
    [router]
  );

  const trimmedQuery = query.trim();
  const hasResults = results.wiki.length > 0 || results.posts.length > 0;
  const isSearching = trimmedQuery.length >= 2 && loading;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search content"
      description="Search wiki articles and blog posts. Use the arrow keys to move through results and press Enter to open one."
    >
      <CommandInput placeholder="Search wiki and posts..." value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[460px]">
        {isSearching && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching...</div>}

        {!isSearching && trimmedQuery.length < 2 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</div>
        )}

        {!isSearching && trimmedQuery.length >= 2 && hasSearched && !hasResults && (
          <CommandEmpty>No results found for "{trimmedQuery}".</CommandEmpty>
        )}

        {!isSearching && results.wiki.length > 0 && (
          <CommandGroup heading="Wiki Articles">
            {results.wiki.map((item) => (
              <CommandItem
                key={`wiki-${item.id}`}
                value={`wiki-${item.slug}-${item.title}`}
                onSelect={() => navigate(`/wiki/${item.slug}`)}
                className="items-start gap-3 px-3"
              >
                <BookOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {buildMeta([
                      'Wiki article',
                      item.modifiedAtGmt ? `Updated ${formatDate(item.modifiedAtGmt)}` : null,
                      item.category
                    ])}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!isSearching && results.wiki.length > 0 && results.posts.length > 0 && <CommandSeparator />}

        {!isSearching && results.posts.length > 0 && (
          <CommandGroup heading="Blog Posts">
            {results.posts.map((item) => (
              <CommandItem
                key={`post-${item.id}`}
                value={`post-${item.slug}-${item.title}`}
                onSelect={() => navigate(`/posts/${item.slug}`)}
                className="items-start gap-3 px-3"
              >
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {buildMeta([
                      'Blog post',
                      item.publishedAtGmt ? formatDate(item.publishedAtGmt) : null,
                      item.category
                    ])}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
