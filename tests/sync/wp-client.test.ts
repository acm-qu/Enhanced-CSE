import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  discoverTaxonomies,
  fetchAllTerms,
  fetchAllWikiArticles,
  fetchAllWpCategories,
  fetchAllWpPosts
} from '@/lib/wp/client';

function responseJson(value: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {})
    }
  });
}

describe('wordpress client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      WP_API_BASE: 'https://example.org/wp-json/wp/v2'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('discovers category and tag taxonomies from post type', async () => {
    const fetchMock = vi.fn(async () =>
      responseJson({
        taxonomies: ['epkb_post_type_1_category', 'epkb_post_type_1_tag']
      })
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const discovery = await discoverTaxonomies('epkb_post_type_1');
    expect(discovery.categoryTaxonomy).toBe('epkb_post_type_1_category');
    expect(discovery.tagTaxonomy).toBe('epkb_post_type_1_tag');
  });

  it('falls back to default category taxonomy when discovery fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network');
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const discovery = await discoverTaxonomies('epkb_post_type_1');
    expect(discovery.categoryTaxonomy).toBe('epkb_post_type_1_category');
    expect(discovery.tagTaxonomy).toBeNull();
  });

  it('fetches all pages for terms and wiki articles', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get('page'));
      const path = parsed.pathname;

      if (path.endsWith('/epkb_post_type_1_category') && page === 1) {
        return responseJson(Array.from({ length: 100 }, (_, i) => ({ id: i + 1, slug: `term-${i + 1}`, name: `Term ${i + 1}` })), {
          'x-wp-totalpages': '2'
        });
      }

      if (path.endsWith('/epkb_post_type_1_category') && page === 2) {
        return responseJson([{ id: 101, slug: 'term-101', name: 'Term 101' }], {
          'x-wp-totalpages': '2'
        });
      }

      if (path.endsWith('/epkb_post_type_1') && page === 1) {
        return responseJson([{ id: 10, slug: 'post-10', title: { rendered: 'P10' }, content: { rendered: '' }, excerpt: { rendered: '' }, date_gmt: null, modified_gmt: null, link: 'http://source/10', status: 'publish' }], {
          'x-wp-totalpages': '1'
        });
      }

      return responseJson([]);
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const terms = await fetchAllTerms('epkb_post_type_1_category');
    const posts = await fetchAllWikiArticles('epkb_post_type_1');

    expect(terms).toHaveLength(101);
    expect(posts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches all pages for wp categories and wp posts', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get('page'));
      const path = parsed.pathname;

      if (path.endsWith('/categories') && page === 1) {
        return responseJson(
          Array.from({ length: 100 }, (_, i) => ({ id: i + 1, slug: `cat-${i + 1}`, name: `Category ${i + 1}` })),
          {
            'x-wp-totalpages': '2'
          }
        );
      }

      if (path.endsWith('/categories') && page === 2) {
        return responseJson([{ id: 101, slug: 'cat-101', name: 'Category 101' }], {
          'x-wp-totalpages': '2'
        });
      }

      if (path.endsWith('/posts') && page === 1) {
        return responseJson(
          [
            {
              id: 22,
              slug: 'hello-world',
              title: { rendered: 'Hello World' },
              content: { rendered: '' },
              excerpt: { rendered: '' },
              date_gmt: null,
              modified_gmt: null,
              link: 'http://source/22',
              status: 'publish',
              categories: [1, 2]
            }
          ],
          {
            'x-wp-totalpages': '1'
          }
        );
      }

      return responseJson([]);
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const categories = await fetchAllWpCategories();
    const posts = await fetchAllWpPosts();

    expect(categories).toHaveLength(101);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.slug).toBe('hello-world');
  });
});
