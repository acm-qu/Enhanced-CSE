import Link from 'next/link';

import type { ContentMediaPreview } from '@/lib/content/media-preview';

interface ContentCardPreviewProps {
  href: string;
  previews: ContentMediaPreview[];
}

export function ContentCardPreview({ href, previews }: ContentCardPreviewProps) {
  if (previews.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Preview</div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {previews.map((preview) => (
          <Link
            key={`${preview.kind}:${preview.src}`}
            href={href}
            className="group relative block h-[105px] w-[140px] shrink-0 overflow-hidden rounded-lg border border-border/70 bg-black/10 hover:border-primary/45"
          >
            <img
              src={preview.src}
              alt={preview.alt}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
