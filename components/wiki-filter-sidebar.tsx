'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { ArticleSort } from '@/lib/db/queries';
import { formatContentLabel } from '@/lib/utils/content';

interface WikiFilterSidebarProps {
  categories: Array<{ slug: string; name: string }>;
  tags: Array<{ slug: string; name: string }>;
  sortOptions: Array<{ value: ArticleSort; label: string }>;
  currentSort: ArticleSort;
  currentCategory?: string;
  currentTag?: string;
}

export function WikiFilterSidebar({
  categories,
  tags,
  sortOptions,
  currentSort,
  currentCategory,
  currentTag
}: WikiFilterSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState(currentSort);
  const [category, setCategory] = useState(currentCategory ?? '');
  const [tag, setTag] = useState(currentTag ?? '');

  const buildHref = (newSort: string, newCategory: string, newTag: string) => {
    const params = new URLSearchParams();

    if (newSort && newSort !== 'modified_desc') {
      params.set('sort', newSort);
    }

    if (newCategory) {
      params.set('category', newCategory);
    }

    if (newTag) {
      params.set('tag', newTag);
    }

    const query = params.toString();
    return query ? `/wiki?${query}` : '/wiki';
  };

  const handleSortChange = (value: string) => {
    setSort(value as ArticleSort);
    startTransition(() => router.push(buildHref(value, category, tag)));
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    startTransition(() => router.push(buildHref(sort, value, tag)));
  };

  const handleTagChange = (value: string) => {
    setTag(value);
    startTransition(() => router.push(buildHref(sort, category, value)));
  };

  const handleReset = () => {
    setSort('modified_desc');
    setCategory('');
    setTag('');
    startTransition(() => router.push('/wiki'));
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

  const tagComboboxOptions: ComboboxOption[] = [
    { value: '', label: 'All tags' },
    ...tags.map((tagItem) => ({
      value: tagItem.slug,
      label: formatContentLabel(tagItem.name)
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

      <label className="mt-2 grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Tag
      </label>
      <Combobox
        options={tagComboboxOptions}
        value={tag}
        onValueChange={handleTagChange}
        placeholder="Select tag..."
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
