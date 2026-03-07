export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

export function formatContentLabel(value: string): string {
  return decodeHtmlEntities(value).trim();
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slugify(value: string): string {
  return stripTags(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function addHeadingIdsAndBuildToc(html: string): { html: string; toc: TocItem[] } {
  const used = new Map<string, number>();
  const toc: TocItem[] = [];

  const htmlWithAnchors = html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, levelRaw, attrsRaw, innerHtml) => {
    const level = Number(levelRaw);
    const text = stripTags(innerHtml);
    if (!text) {
      return _match;
    }

    const existingIdMatch = String(attrsRaw).match(/\sid=(['"])(.*?)\1/i);
    let headingId = existingIdMatch?.[2] ?? '';

    if (!headingId) {
      const base = slugify(text) || 'section';
      const seen = used.get(base) ?? 0;
      headingId = seen === 0 ? base : `${base}-${seen + 1}`;
      used.set(base, seen + 1);
    }

    toc.push({ id: headingId, text, level });

    if (existingIdMatch) {
      return `<h${level}${attrsRaw}>${innerHtml}</h${level}>`;
    }

    return `<h${level}${attrsRaw} id="${headingId}">${innerHtml}</h${level}>`;
  });

  // Unwrap <a> tags that only contain an <img> so image clicks aren't swallowed by links
  const htmlUnwrapped = htmlWithAnchors.replace(
    /<a\b[^>]*>\s*(<img\b[^>]*\/?>)\s*<\/a>/gi,
    '$1'
  );

  return { html: htmlUnwrapped, toc };
}
