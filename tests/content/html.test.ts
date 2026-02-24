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

  it('materializes elementor youtube widgets into iframes', () => {
    const html =
      '<div class="elementor-widget-video" data-settings="{&quot;youtube_url&quot;:&quot;https:\\/\\/youtu.be\\/legtfYhy-iI?si=test&quot;,&quot;video_type&quot;:&quot;youtube&quot;}"><div class="elementor-widget-container"><div class="elementor-video"></div></div></div>';
    const sanitized = sanitizeWikiHtml(html);

    expect(sanitized).toContain('https://www.youtube.com/embed/legtfYhy-iI?rel=0');
    expect(sanitized).toContain('<iframe');
    expect(sanitized).not.toContain('elementor-video');
  });

  it('strips legacy knowledge-base chrome and feedback blocks', () => {
    const html =
      '<div id="eckb-article-content-header-v2"><div>&lt; All Topics</div><div>Print</div><div>PostedJanuary 26, 2021</div><div>ByAbdulahi Hassen</div></div><div id="eckb-article-content-body"><p>Internship details body</p></div><div id="eckb-article-content-footer"><section id="eprf-article-buttons-container">Was this article helpful?</section><form class="eprf-article-feedback__form">How can we improve this article?</form></div>';
    const sanitized = sanitizeWikiHtml(html);

    expect(sanitized).toContain('Internship details body');
    expect(sanitized).not.toContain('All Topics');
    expect(sanitized).not.toContain('Was this article helpful?');
    expect(sanitized).not.toContain('How can we improve this article?');
    expect(sanitized).not.toContain('PostedJanuary 26, 2021');
    expect(sanitized).not.toContain('ByAbdulahi Hassen');
  });
});
