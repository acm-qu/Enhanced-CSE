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

interface SearchResult {
  id: number;
  slug: string;
  title: string;
}

interface SearchResults {
  wiki: SearchResult[];
  posts: SearchResult[];
}

const OPEN_SEARCH_EVENT = 'open-search';

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
      <span className="hidden sm:inline ml-1.5">Search</span>
      <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground sm:inline-flex items-center gap-0.5">
        <span>⌘</span>K
      </kbd>
    </Button>
  );
}

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ wiki: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const handleCustomEvent = () => setOpen((prev) => !prev);

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
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          setResults(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery('');
  };

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      router.push(href);
    },
    [router]
  );

  const trimmedQuery = query.trim();
  const hasResults = results.wiki.length > 0 || results.posts.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Search wiki and posts..." value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[420px]">
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>}

        {!loading && trimmedQuery.length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</div>
        )}

        {!loading && trimmedQuery.length >= 2 && !hasResults && <CommandEmpty>No results found for &ldquo;{trimmedQuery}&rdquo;.</CommandEmpty>}

        {!loading && results.wiki.length > 0 && (
          <CommandGroup heading="Wiki Articles">
            {results.wiki.map((item) => (
              <CommandItem
                key={`wiki-${item.id}`}
                value={`wiki-${item.slug}-${item.title}`}
                onSelect={() => navigate(`/wiki/${item.slug}`)}
              >
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && results.wiki.length > 0 && results.posts.length > 0 && <CommandSeparator />}

        {!loading && results.posts.length > 0 && (
          <CommandGroup heading="Blog Posts">
            {results.posts.map((item) => (
              <CommandItem
                key={`post-${item.id}`}
                value={`post-${item.slug}-${item.title}`}
                onSelect={() => navigate(`/posts/${item.slug}`)}
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
