import sanitizeHtml from 'sanitize-html';

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
    if (!slug || slug === 'index.php' || /^\\d+$/.test(slug)) {
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
  return sanitizeHtml(html, {
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
      ]
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
      }
    }
  });
}

export const sanitizeContentHtml = sanitizeWikiHtml;
