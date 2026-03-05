const SOURCE_HOST = 'blogs.qu.edu.qa';
const SOURCE_BASE_URL = `https://${SOURCE_HOST}`;
const MEDIA_PROXY_ROUTE = '/api/media';

function hasExplicitScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function isProxyableProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

function safeParseUrl(value: string, base?: string): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

export function resolveSourceAssetUrl(rawUrl: string): URL | null {
  const value = rawUrl.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('//')) {
    const parsed = safeParseUrl(`https:${value}`);
    if (!parsed || parsed.hostname.toLowerCase() !== SOURCE_HOST || !isProxyableProtocol(parsed.protocol)) {
      return null;
    }

    return parsed;
  }

  if (value.startsWith('/')) {
    const parsed = safeParseUrl(value, SOURCE_BASE_URL);
    if (!parsed || parsed.hostname.toLowerCase() !== SOURCE_HOST || !isProxyableProtocol(parsed.protocol)) {
      return null;
    }

    return parsed;
  }

  if (!hasExplicitScheme(value)) {
    const sourceRelative = value.startsWith('cse/') ? `/${value}` : value;
    const parsed = safeParseUrl(sourceRelative, SOURCE_BASE_URL);
    if (!parsed || parsed.hostname.toLowerCase() !== SOURCE_HOST || !isProxyableProtocol(parsed.protocol)) {
      return null;
    }

    return parsed;
  }

  const parsed = safeParseUrl(value);
  if (!parsed || parsed.hostname.toLowerCase() !== SOURCE_HOST || !isProxyableProtocol(parsed.protocol)) {
    return null;
  }

  return parsed;
}

export function createMediaProxyUrl(rawUrl: string): string | null {
  const parsed = resolveSourceAssetUrl(rawUrl);
  if (!parsed) {
    return null;
  }

  return `${MEDIA_PROXY_ROUTE}?url=${encodeURIComponent(parsed.toString())}`;
}

export function rewriteImageSource(rawUrl: string): string {
  const value = rawUrl.trim();
  if (!value) {
    return rawUrl;
  }

  const proxiedSource = createMediaProxyUrl(value);
  if (proxiedSource) {
    return proxiedSource;
  }

  if (value.startsWith('http://')) {
    return `https://${value.slice('http://'.length)}`;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  return value;
}

function rewriteSrcSetCandidate(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return '';
  }

  const firstWhitespace = trimmed.search(/\s/);
  if (firstWhitespace === -1) {
    return rewriteImageSource(trimmed);
  }

  const url = trimmed.slice(0, firstWhitespace);
  const descriptor = trimmed.slice(firstWhitespace).trim();
  const rewrittenUrl = rewriteImageSource(url);

  return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
}

export function rewriteImageSrcSet(rawSrcSet: string): string {
  return rawSrcSet
    .split(',')
    .map(rewriteSrcSetCandidate)
    .filter(Boolean)
    .join(', ');
}

export function isImageContentType(contentType: string | null): boolean {
  return (contentType ?? '').toLowerCase().startsWith('image/');
}
