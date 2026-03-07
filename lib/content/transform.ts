import sanitizeHtml from 'sanitize-html';

import type { PostDetailItem, PostListItem } from '@/lib/db/posts-queries';
import type { ArticleDetailItem, ArticleListItem } from '@/lib/db/queries';
import { sanitizeContentHtml, sanitizeWikiHtml } from '@/lib/content/html';
import { extractContentMediaPreviews } from '@/lib/content/media-preview';

function sanitizeTitle(title: string): string {
  return sanitizeHtml(title, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

export function toArticleListResponse(article: ArticleListItem) {
  return {
    id: article.id,
    slug: article.slug,
    title: sanitizeTitle(article.title),
    excerptHtml: sanitizeWikiHtml(article.excerptHtmlRaw),
    mediaPreviews: extractContentMediaPreviews(article.contentHtmlRaw || article.excerptHtmlRaw),
    sourceLink: article.sourceLink,
    publishedAtGmt: article.publishedAtGmt?.toISOString() ?? null,
    modifiedAtGmt: article.modifiedAtGmt?.toISOString() ?? null,
    categories: article.categories,
    tags: article.tags
  };
}

export function toArticleDetailResponse(article: ArticleDetailItem) {
  return {
    id: article.id,
    slug: article.slug,
    title: sanitizeTitle(article.title),
    contentHtml: sanitizeWikiHtml(article.contentHtmlRaw),
    excerptHtml: sanitizeWikiHtml(article.excerptHtmlRaw),
    sourceLink: article.sourceLink,
    publishedAtGmt: article.publishedAtGmt?.toISOString() ?? null,
    modifiedAtGmt: article.modifiedAtGmt?.toISOString() ?? null,
    categories: article.categories,
    tags: article.tags
  };
}

export function toPostListResponse(post: PostListItem) {
  return {
    id: post.id,
    slug: post.slug,
    title: sanitizeTitle(post.title),
    excerptHtml: sanitizeContentHtml(post.excerptHtmlRaw),
    mediaPreviews: extractContentMediaPreviews(post.contentHtmlRaw || post.excerptHtmlRaw),
    sourceLink: post.sourceLink,
    publishedAtGmt: post.publishedAtGmt?.toISOString() ?? null,
    modifiedAtGmt: post.modifiedAtGmt?.toISOString() ?? null,
    categories: post.categories
  };
}

export function toPostDetailResponse(post: PostDetailItem) {
  return {
    id: post.id,
    slug: post.slug,
    title: sanitizeTitle(post.title),
    contentHtml: sanitizeContentHtml(post.contentHtmlRaw),
    excerptHtml: sanitizeContentHtml(post.excerptHtmlRaw),
    sourceLink: post.sourceLink,
    publishedAtGmt: post.publishedAtGmt?.toISOString() ?? null,
    modifiedAtGmt: post.modifiedAtGmt?.toISOString() ?? null,
    categories: post.categories
  };
}
