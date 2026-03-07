import { rewriteImageSource } from '@/lib/content/asset-proxy';

export interface ContentMediaPreview {
  kind: 'image' | 'youtube';
  src: string;
  alt: string;
}

const MAX_PREVIEWS = 6;
const BLOG_FEEDBACK_MARKERS = [
  'Was this article helpful?',
  'How can we improve this article?',
  'Table of Contents'
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeMediaUrl(value: string): string {
  return decodeHtmlEntities(value).replace(/\\\//g, '/').trim();
}

function extractTagAttribute(tag: string, attributeName: string): string | null {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, 'i');
  const match = tag.match(pattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
  const normalized = normalizeMediaUrl(value);
  return normalized || null;
}

function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const parsed = new URL(normalizeMediaUrl(rawUrl));
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

    return cleanId;
  } catch {
    return null;
  }
}

function toYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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

  current = current.replace(/<div[^>]*id="eckb-article-content-footer"[\s\S]*$/i, '');

  for (const marker of BLOG_FEEDBACK_MARKERS) {
    current = current.replace(new RegExp(escapeRegExp(marker), 'gi'), '');
  }

  return current;
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

    const normalized = normalizeMediaUrl(youtubeUrl);
    if (normalized) {
      urls.push(normalized);
    }
  }

  return urls;
}

function pushPreview(previews: ContentMediaPreview[], seen: Set<string>, preview: ContentMediaPreview, limit: number): void {
  const key = `${preview.kind}:${preview.src}`;
  if (seen.has(key) || previews.length >= limit) {
    return;
  }

  seen.add(key);
  previews.push(preview);
}

export function extractContentMediaPreviews(html: string, limit = MAX_PREVIEWS): ContentMediaPreview[] {
  const preparedHtml = stripLegacyFeedbackAndMeta(extractLegacyKbBody(html));
  const previews: ContentMediaPreview[] = [];
  const seen = new Set<string>();
  const tagPattern = /<img\b[^>]*>|<iframe\b[^>]*>|<a\b[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(preparedHtml)) !== null && previews.length < limit) {
    const tag = match[0] ?? '';

    if (/^<img\b/i.test(tag)) {
      const src = extractTagAttribute(tag, 'src');
      if (!src || src.startsWith('data:')) {
        continue;
      }

      pushPreview(
        previews,
        seen,
        {
          kind: 'image',
          src: rewriteImageSource(src),
          alt: extractTagAttribute(tag, 'alt') ?? 'Article preview image'
        },
        limit
      );
      continue;
    }

    const mediaUrl = extractTagAttribute(tag, /^<iframe\b/i.test(tag) ? 'src' : 'href');
    if (!mediaUrl) {
      continue;
    }

    const videoId = extractYouTubeVideoId(mediaUrl);
    if (!videoId) {
      continue;
    }

    pushPreview(
      previews,
      seen,
      {
        kind: 'youtube',
        src: toYouTubeThumbnailUrl(videoId),
        alt: 'YouTube video thumbnail'
      },
      limit
    );
  }

  if (previews.length >= limit) {
    return previews;
  }

  for (const url of extractElementorYoutubeUrls(preparedHtml)) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      continue;
    }

    pushPreview(
      previews,
      seen,
      {
        kind: 'youtube',
        src: toYouTubeThumbnailUrl(videoId),
        alt: 'YouTube video thumbnail'
      },
      limit
    );
  }

  return previews;
}


