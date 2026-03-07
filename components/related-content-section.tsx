import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatedContentItem {
  href: string;
  title: string;
  summary: string;
  dateLabel: string;
}

interface RelatedContentSectionProps {
  eyebrow: string;
  title: string;
  items: RelatedContentItem[];
  viewAllHref: string;
  viewAllLabel: string;
}

export function RelatedContentSection({
  eyebrow,
  title,
  items,
  viewAllHref,
  viewAllLabel
}: RelatedContentSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <Link href={viewAllHref} className="text-sm font-semibold text-[#2CAD9E] transition-colors hover:text-[#3AE4D1]">
          {viewAllLabel}
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.href} className="panel-muted h-full">
            <CardHeader className="space-y-2 pb-3">
              <Badge variant="outline" className="w-fit">
                {item.dateLabel}
              </Badge>
              <CardTitle className="text-lg leading-snug">
                <Link href={item.href} className="underline-offset-2 hover:underline">
                  {item.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-foreground/78">{item.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
