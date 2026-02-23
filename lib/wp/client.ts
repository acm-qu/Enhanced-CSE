import { getWpApiBase } from '@/lib/internal/env';

const DEFAULT_PER_PAGE = 100;

export interface WpRenderedField {
  rendered: string;
}

export interface WpArticleResponse {
  id: number;
  slug: string;
  title: WpRenderedField;
  content: WpRenderedField;
  excerpt: WpRenderedField;
  date_gmt: string | null;
  modified_gmt: string | null;
  link: string;
  status: string;
  [key: string]: unknown;
}

export interface WpBlogPostResponse extends WpArticleResponse {
  categories?: unknown;
}

export interface WpTermResponse {
  id: number;
  slug: string;
  name: string;
  description?: string;
  parent?: number;
}

interface WpTypeResponse {
  taxonomies?: string[];
}

interface WpFetchResult<T> {
  data: T;
  totalPages: number | null;
}

export interface WpTaxonomyDiscovery {
  categoryTaxonomy: string;
  tagTaxonomy: string | null;
  allTaxonomies: string[];
}

function buildWpUrl(path: string, params: Record<string, string | number | undefined>): URL {
  const base = getWpApiBase();
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(`${base}/${normalizedPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

async function fetchWpJson<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<WpFetchResult<T>> {
  const url = buildWpUrl(path, params);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WordPress request failed ${response.status} for ${url.toString()}: ${body}`);
  }

  const data = (await response.json()) as T;
  const totalPagesHeader = response.headers.get('x-wp-totalpages');
  const totalPages = totalPagesHeader ? Number(totalPagesHeader) : null;

  return {
    data,
    totalPages: Number.isFinite(totalPages ?? NaN) ? totalPages : null
  };
}

async function fetchWpPaginated<T>(path: string): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let totalPages: number | null = null;

  while (totalPages === null || page <= totalPages) {
    const { data, totalPages: discoveredTotalPages } = await fetchWpJson<T[]>(path, {
      per_page: DEFAULT_PER_PAGE,
      page
    });

    if (discoveredTotalPages !== null) {
      totalPages = discoveredTotalPages;
    }

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    allItems.push(...data);

    if (data.length < DEFAULT_PER_PAGE && totalPages === null) {
      break;
    }

    page += 1;
  }

  return allItems;
}

function findTaxonomyByHint(taxonomies: string[], hint: 'category' | 'tag'): string | null {
  const lowercaseHint = hint.toLowerCase();
  const candidate = taxonomies.find((name) => name.toLowerCase().includes(lowercaseHint));
  return candidate ?? null;
}

export async function discoverTaxonomies(postType: string): Promise<WpTaxonomyDiscovery> {
  const fallbackCategoryTaxonomy = `${postType}_category`;

  try {
    const { data } = await fetchWpJson<WpTypeResponse>(`types/${postType}`);
    const taxonomies = Array.isArray(data.taxonomies) ? data.taxonomies : [];

    const categoryTaxonomy = findTaxonomyByHint(taxonomies, 'category') ?? fallbackCategoryTaxonomy;
    const tagTaxonomy = findTaxonomyByHint(taxonomies, 'tag');

    return {
      categoryTaxonomy,
      tagTaxonomy,
      allTaxonomies: taxonomies
    };
  } catch {
    return {
      categoryTaxonomy: fallbackCategoryTaxonomy,
      tagTaxonomy: null,
      allTaxonomies: [fallbackCategoryTaxonomy]
    };
  }
}

export async function fetchAllTerms(taxonomy: string): Promise<WpTermResponse[]> {
  return fetchWpPaginated<WpTermResponse>(taxonomy);
}

export async function fetchAllWikiArticles(postType: string): Promise<WpArticleResponse[]> {
  return fetchWpPaginated<WpArticleResponse>(postType);
}

export async function fetchAllWpCategories(): Promise<WpTermResponse[]> {
  return fetchWpPaginated<WpTermResponse>('categories');
}

export async function fetchAllWpPosts(): Promise<WpBlogPostResponse[]> {
  return fetchWpPaginated<WpBlogPostResponse>('posts');
}

export const fetchAllArticles = fetchAllWikiArticles;
