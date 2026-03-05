import sanitizeHtml from 'sanitize-html';

import { rewriteImageSource, rewriteImageSrcSet } from '@/lib/content/asset-proxy';

const SOURCE_HOST = 'blogs.qu.edu.qa';
const SOURCE_PATH_PREFIX = '/cse/wiki';
const SOURCE_BLOG_PREFIX = '/cse/';
const BLOG_NON_POST_PREFIXES = new Set([
  'wiki',
  'category',
  'tag',
  'author',
  'feed',
  'comments',
  'wp-json',
  'wp-content',
  'wp-admin',
  'page'
]);

function normalizePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }
  if (!pathname.startsWith('/')) {
    return `/${pathname}`;
  }
  return pathname;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

function toYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname.toLowerCase();
    let videoId = '';

    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    } else if (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'www.youtube-nocookie.com'
    ) {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v') ?? '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.replace('/embed/', '').split('/')[0] ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.replace('/shorts/', '').split('/')[0] ?? '';
      }
    }

    const cleanId = videoId.trim();
    if (!cleanId || !/^[a-zA-Z0-9_-]{6,}$/.test(cleanId)) {
      return null;
    }

    return `https://www.youtube.com/embed/${cleanId}?rel=0`;
  } catch {
    return null;
  }
}

function extractElementorYoutubeUrls(html: string): string[] {
  const urls: string[] = [];
  const regex = /data-settings="([^"]*)"/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawSettings = match[1] ?? '';
    if (!rawSettings.toLowerCase().includes('youtube_url')) {
      continue;
    }

    const decoded = decodeHtmlEntities(rawSettings);
    let youtubeUrl = '';

    try {
      const parsed = JSON.parse(decoded) as { youtube_url?: string };
      youtubeUrl = parsed.youtube_url ?? '';
    } catch {
      const fallback = decoded.match(/"youtube_url":"([^"]+)"/i);
      youtubeUrl = fallback?.[1] ?? '';
    }

    const normalizedUrl = youtubeUrl.replace(/\\\//g, '/').trim();
    if (normalizedUrl) {
      urls.push(normalizedUrl);
    }
  }

  return urls;
}

function materializeElementorYoutubeEmbeds(html: string): string {
  const urls = extractElementorYoutubeUrls(html);
  if (urls.length === 0) {
    return html;
  }

  let index = 0;
  return html.replace(/<div[^>]*class="[^"]*elementor-video[^"]*"[^>]*>\s*<\/div>/gi, () => {
    const sourceUrl = urls[index] ?? '';
    index += 1;

    const embedUrl = toYouTubeEmbedUrl(sourceUrl);
    if (!embedUrl) {
      return '';
    }

    return `<iframe src="${embedUrl}" title="YouTube video player" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });
}

function extractLegacyKbBody(html: string): string {
  const wrappedBody = html.match(
    /<div[^>]*id="eckb-article-content-body"[^>]*>([\s\S]*?)<div[^>]*id="eckb-article-content-footer"[^>]*>/i
  );

  if (wrappedBody?.[1]) {
    return wrappedBody[1];
  }

  const bodyOnly = html.match(/<div[^>]*id="eckb-article-content-body"[^>]*>([\s\S]*?)<\/div>/i);
  if (bodyOnly?.[1]) {
    return bodyOnly[1];
  }

  return html;
}

function stripLegacyFeedbackAndMeta(html: string): string {
  let current = html;

  const blockPatterns: RegExp[] = [
    /<section[^>]*(?:id|class)="[^"]*eprf-[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
    /<div[^>]*(?:id|class)="[^"]*eprf-[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<form[^>]*(?:id|class)="[^"]*eprf-[^"]*"[^>]*>[\s\S]*?<\/form>/gi,
    /<div[^>]*id="eckb-article-content-footer"[\s\S]*$/i
  ];

  for (const pattern of blockPatterns) {
    current = current.replace(pattern, '');
  }

  const textPatterns: RegExp[] = [
    /Was this article helpful\?/gi,
    /How can we improve this article\??/gi,
    /\bTable of Contents\b/gi,
    /&lt;\s*All Topics/gi,
    /<\s*All Topics/gi
  ];

  for (const pattern of textPatterns) {
    current = current.replace(pattern, '');
  }

  return current;
}

export function extractWikiSlugFromUrl(href: string): string | null {
  try {
    const placeholderHost = 'placeholder.local';
    const url = new URL(href, `http://${placeholderHost}`);
    const path = normalizePath(url.pathname).replace(/\/+$/, '');

    if (url.hostname && url.hostname !== SOURCE_HOST && url.hostname !== placeholderHost) {
      return null;
    }

    if (!path.startsWith(SOURCE_PATH_PREFIX)) {
      return null;
    }

    const segments = path.split('/').filter(Boolean);
    const wikiIndex = segments.findIndex((segment) => segment === 'wiki');
    if (wikiIndex < 0 || wikiIndex + 1 >= segments.length) {
      return null;
    }

    const slug = segments[wikiIndex + 1].trim();
    if (!slug || slug === 'index.php') {
      return null;
    }

    return slug;
  } catch {
    return null;
  }
}

export function extractBlogPostSlugFromUrl(href: string): string | null {
  try {
    const placeholderHost = 'placeholder.local';
    const url = new URL(href, `http://${placeholderHost}`);
    const path = normalizePath(url.pathname).replace(/\/+$/, '');

    if (url.hostname && url.hostname !== SOURCE_HOST && url.hostname !== placeholderHost) {
      return null;
    }

    if (!path.startsWith(SOURCE_BLOG_PREFIX) || path.startsWith(SOURCE_PATH_PREFIX)) {
      return null;
    }

    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== 'cse') {
      return null;
    }

    const secondSegment = (segments[1] ?? '').toLowerCase();
    if (BLOG_NON_POST_PREFIXES.has(secondSegment)) {
      return null;
    }

    const slug = (segments[segments.length - 1] ?? '').trim();
    if (!slug || slug === 'index.php' || /^\d+$/.test(slug)) {
      return null;
    }

    return slug;
  } catch {
    return null;
  }
}

export function rewriteInternalWikiHref(href: string): string {
  const slug = extractWikiSlugFromUrl(href);
  if (!slug) {
    return href;
  }

  return `/wiki/${slug}`;
}

export function rewriteInternalBlogPostHref(href: string): string {
  const slug = extractBlogPostSlugFromUrl(href);
  if (!slug) {
    return href;
  }

  return `/posts/${slug}`;
}

export function rewriteInternalContentHref(href: string): string {
  const wikiHref = rewriteInternalWikiHref(href);
  if (wikiHref !== href) {
    return wikiHref;
  }

  return rewriteInternalBlogPostHref(href);
}

export function sanitizeWikiHtml(html: string): string {
  const legacyTrimmed = stripLegacyFeedbackAndMeta(extractLegacyKbBody(html));
  const htmlWithEmbeds = materializeElementorYoutubeEmbeds(legacyTrimmed);

  return sanitizeHtml(htmlWithEmbeds, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'iframe',
      'figure',
      'figcaption'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: [
        'src',
        'title',
        'width',
        'height',
        'frameborder',
        'allow',
        'allowfullscreen',
        'loading',
        'referrerpolicy'
      ],
      td: ['rowspan', 'colspan'],
      th: ['rowspan', 'colspan']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtu.be'],
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ?? '';
        const rewrittenHref = href ? rewriteInternalContentHref(href) : href;
        const nextAttribs: Record<string, string> = {
          ...attribs,
          href: rewrittenHref
        };

        if (rewrittenHref.startsWith('http://') || rewrittenHref.startsWith('https://')) {
          nextAttribs.rel = 'noopener noreferrer';
        }

        return {
          tagName: 'a',
          attribs: nextAttribs
        };
      },
      img: (_tagName, attribs) => {
        const nextAttribs: Record<string, string> = {
          ...attribs
        };

        if (attribs.src) {
          nextAttribs.src = rewriteImageSource(attribs.src);
        }

        if (attribs.srcset) {
          nextAttribs.srcset = rewriteImageSrcSet(attribs.srcset);
        }

        if (!nextAttribs.loading) {
          nextAttribs.loading = 'lazy';
        }

        return {
          tagName: 'img',
          attribs: nextAttribs
        };
      }
    }
  });
}

export const sanitizeContentHtml = sanitizeWikiHtml;
