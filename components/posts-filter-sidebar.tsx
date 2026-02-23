'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { PostSort } from '@/lib/db/posts-queries';

interface PostsFilterSidebarProps {
  categories: Array<{ slug: string; name: string }>;
  sortOptions: Array<{ value: PostSort; label: string }>;
  currentSort: PostSort;
  currentCategory?: string;
  currentMonth?: string;
}

export function PostsFilterSidebar({
  categories,
  sortOptions,
  currentSort,
  currentCategory,
  currentMonth
}: PostsFilterSidebarProps) {
  const router = useRouter();
  const [sort, setSort] = useState(currentSort);
  const [category, setCategory] = useState(currentCategory ?? '');
  const [month, setMonth] = useState(currentMonth ?? '');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const buildHref = (newSort: string, newCategory: string, newMonth: string) => {
    const params = new URLSearchParams();

    if (newSort && newSort !== 'published_desc') {
      params.set('sort', newSort);
    }

    if (newCategory) {
      params.set('category', newCategory);
    }

    if (newMonth) {
      params.set('month', newMonth);
    }

    const query = params.toString();
    return query ? `/posts?${query}` : '/posts';
  };

  const handleSortChange = (value: string) => {
    setSort(value as PostSort);
    router.push(buildHref(value, category, month));
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    router.push(buildHref(sort, value, month));
  };

  const handleReset = () => {
    setSort('published_desc');
    setCategory('');
    setMonth('');
    router.push('/posts');
  };

  if (!isMounted) {
    return null;
  }

  const sortComboboxOptions: ComboboxOption[] = sortOptions.map((opt) => ({
    value: opt.value,
    label: opt.label
  }));

  const categoryComboboxOptions: ComboboxOption[] = [
    { value: '', label: 'All categories' },
    ...categories.map((cat) => ({
      value: cat.slug,
      label: cat.name
    }))
  ];

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Sort
      </label>
      <Combobox
        options={sortComboboxOptions}
        value={sort}
        onValueChange={handleSortChange}
        placeholder="Select sort..."
      />

      <label className="mt-2 grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Category
      </label>
      <Combobox
        options={categoryComboboxOptions}
        value={category}
        onValueChange={handleCategoryChange}
        placeholder="Select category..."
      />

      <div className="mt-1 flex gap-2">
        <Button
          onClick={() => handleReset()}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
