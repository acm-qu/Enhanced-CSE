import { describe, expect, it } from 'vitest';

import {
  extractBlogPostSlugFromUrl,
  extractWikiSlugFromUrl,
  rewriteInternalBlogPostHref,
  rewriteInternalWikiHref,
  sanitizeWikiHtml
} from '@/lib/content/html';

describe('content html utilities', () => {
  it('extracts wiki slug from internal wiki links', () => {
    const slug = extractWikiSlugFromUrl('http://blogs.qu.edu.qa/cse/wiki/data-structures/');
    expect(slug).toBe('data-structures');
  });

  it('does not extract slug from external links', () => {
    const slug = extractWikiSlugFromUrl('https://example.com/cse/wiki/data-structures/');
    expect(slug).toBeNull();
  });

  it('rewrites internal wiki links to local route', () => {
    const href = rewriteInternalWikiHref('http://blogs.qu.edu.qa/cse/wiki/c-plus-plus/');
    expect(href).toBe('/wiki/c-plus-plus');
  });

  it('rewrites relative wiki links to local route', () => {
    const href = rewriteInternalWikiHref('/cse/wiki/algorithms/');
    expect(href).toBe('/wiki/algorithms');
  });

  it('extracts blog post slug from dated permalink', () => {
    const slug = extractBlogPostSlugFromUrl('https://blogs.qu.edu.qa/cse/2024/09/12/compiler-design/');
    expect(slug).toBe('compiler-design');
  });

  it('does not treat category archive as a post permalink', () => {
    const slug = extractBlogPostSlugFromUrl('https://blogs.qu.edu.qa/cse/category/news/');
    expect(slug).toBeNull();
  });

  it('rewrites internal post links to local posts route', () => {
    const href = rewriteInternalBlogPostHref('https://blogs.qu.edu.qa/cse/2025/01/17/new-semester-announcement/');
    expect(href).toBe('/posts/new-semester-announcement');
  });

  it('sanitizes script tags and rewrites internal anchors', () => {
    const html =
      '<p>Text</p><script>alert(1)</script><a href="http://blogs.qu.edu.qa/cse/wiki/oop/">OOP</a><a href="https://blogs.qu.edu.qa/cse/2024/09/12/compiler-design/">Post</a>';
    const sanitized = sanitizeWikiHtml(html);

    expect(sanitized).toContain('<p>Text</p>');
    expect(sanitized).toContain('href="/wiki/oop"');
    expect(sanitized).toContain('href="/posts/compiler-design"');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert(1)');
  });

  it('keeps youtube iframes and strips non-whitelisted iframe hosts', () => {
    const html =
      '<iframe src="https://www.youtube.com/embed/abc123" title="yt"></iframe><iframe src="https://evil.example/embed/abc123" title="bad"></iframe>';
    const sanitized = sanitizeWikiHtml(html);

    expect(sanitized).toContain('https://www.youtube.com/embed/abc123');
    expect(sanitized).toContain('<iframe');
    expect(sanitized).not.toContain('https://evil.example/embed/abc123');
  });
});
