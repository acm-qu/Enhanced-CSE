'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { PostSort } from '@/lib/db/posts-queries';
import { formatContentLabel } from '@/lib/utils/content';

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
  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState(currentSort);
  const [category, setCategory] = useState(currentCategory ?? '');
  const [month, setMonth] = useState(currentMonth ?? '');

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
    startTransition(() => router.push(buildHref(value, category, month)));
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    startTransition(() => router.push(buildHref(sort, value, month)));
  };

  const handleReset = () => {
    setSort('published_desc');
    setCategory('');
    setMonth('');
    startTransition(() => router.push('/posts'));
  };

  const sortComboboxOptions: ComboboxOption[] = sortOptions.map((option) => ({
    value: option.value,
    label: option.label
  }));

  const categoryComboboxOptions: ComboboxOption[] = [
    { value: '', label: 'All categories' },
    ...categories.map((categoryItem) => ({
      value: categoryItem.slug,
      label: formatContentLabel(categoryItem.name)
    }))
  ];

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Filters
        </label>
        {isPending && <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <label className="grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Sort
      </label>
      <Combobox
        options={sortComboboxOptions}
        value={sort}
        onValueChange={handleSortChange}
        placeholder="Select sort..."
        disabled={isPending}
      />

      <label className="mt-2 grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Category
      </label>
      <Combobox
        options={categoryComboboxOptions}
        value={category}
        onValueChange={handleCategoryChange}
        placeholder="Select category..."
        disabled={isPending}
      />

      <div className="mt-3 flex gap-2">
        <Button onClick={handleReset} variant="outline" size="sm" className="flex-1" disabled={isPending}>
          Reset
        </Button>
      </div>
    </div>
  );
}
