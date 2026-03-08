import { unstable_cache } from 'next/cache';

import { listArticles, listCategories, listTags, type ListArticlesInput } from '@/lib/db/queries';
import { listPostArchives, listPostCategories, listPosts, type ListPostsInput } from '@/lib/db/posts-queries';

export const WIKI_CACHE_TAG = 'wiki-content';
export const POSTS_CACHE_TAG = 'posts-content';

export const getCachedArticles = unstable_cache(
  (input: ListArticlesInput) => listArticles(input),
  ['wiki-articles'],
  { revalidate: 28800, tags: [WIKI_CACHE_TAG] }
);

export const getCachedCategories = unstable_cache(
  () => listCategories(),
  ['wiki-categories'],
  { revalidate: 28800, tags: [WIKI_CACHE_TAG] }
);

export const getCachedTags = unstable_cache(
  () => listTags(),
  ['wiki-tags'],
  { revalidate: 28800, tags: [WIKI_CACHE_TAG] }
);

export const getCachedPosts = unstable_cache(
  (input: ListPostsInput) => listPosts(input),
  ['posts-list'],
  { revalidate: 28800, tags: [POSTS_CACHE_TAG] }
);

export const getCachedPostCategories = unstable_cache(
  () => listPostCategories(),
  ['posts-categories'],
  { revalidate: 28800, tags: [POSTS_CACHE_TAG] }
);

export const getCachedPostArchives = unstable_cache(
  (input?: { categorySlug?: string }) => listPostArchives(input),
  ['posts-archives'],
  { revalidate: 28800, tags: [POSTS_CACHE_TAG] }
);
