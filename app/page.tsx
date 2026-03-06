import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toArticleListResponse, toPostListResponse } from '@/lib/content/transform';
import { listPosts } from '@/lib/db/posts-queries';
import { getSyncMeta, listArticles, listCategories, type TermWithCount } from '@/lib/db/queries';
import { formatDate } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

const FEATURED_CATEGORY_RULES = [
  {
    label: 'Student Services',
    keywords: ['offering', 'service']
  },
  {
    label: 'CSE Focal Point Team',
    keywords: ['focal', 'advisor', 'coordinator']
  },
  {
    label: 'Senior Projects',
    keywords: ['senior', 'project']
  }
] as const;

const CONTENT_LINK_CLASS =
  'group inline-flex items-start gap-2 text-[17px] leading-relaxed text-[#2CAD9E] transition-colors hover:text-[#3AE4D1]';

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sectionDotClass(displayName: string): string {
  const normalized = normalizeText(displayName);

  if (normalized.includes('student')) {
    return 'bg-[#3AE4D1]';
  }

  if (normalized.includes('senior')) {
    return 'bg-[#2CAD9E]';
  }

  if (normalized.includes('focal')) {
    return 'bg-[#373637]';
  }

  return 'bg-[#2CAD9E]';
}

function pickFeaturedCategories(categories: TermWithCount[]): Array<{
  slug: string;
  displayName: string;
  articleCount: number;
}> {
  const selected: Array<{
    slug: string;
    displayName: string;
    articleCount: number;
  }> = [];

  const usedSlugs = new Set<string>();
  const sortedByCount = [...categories].sort((a, b) => b.articleCount - a.articleCount);

  for (const rule of FEATURED_CATEGORY_RULES) {
    const match = sortedByCount.find((category) => {
      if (usedSlugs.has(category.slug)) {
        return false;
      }

      const haystack = `${normalizeText(category.name)} ${normalizeText(category.slug)}`;
      return rule.keywords.some((keyword) => haystack.includes(keyword));
    });

    if (!match) {
      continue;
    }

    usedSlugs.add(match.slug);
    selected.push({
      slug: match.slug,
      displayName: rule.label,
      articleCount: match.articleCount
    });
  }

  for (const category of sortedByCount) {
    if (selected.length >= 3) {
      break;
    }

    if (usedSlugs.has(category.slug)) {
      continue;
    }

    usedSlugs.add(category.slug);
    selected.push({
      slug: category.slug,
      displayName: category.name,
      articleCount: category.articleCount
    });
  }

  return selected.slice(0, 3);
}

export default async function HomePage() {
  const [meta, categories, latestPosts, latestWiki] = await Promise.all([
    getSyncMeta(),
    listCategories(),
    listPosts({
      page: 1,
      pageSize: 6,
      sort: 'published_desc'
    }),
    listArticles({
      page: 1,
      pageSize: 8,
      sort: 'modified_desc'
    })
  ]);

  const featuredCategories = pickFeaturedCategories(categories);
  const featuredSections = await Promise.all(
    featuredCategories.map(async (category) => {
      const articleData = await listArticles({
        page: 1,
        pageSize: 5,
        categorySlug: category.slug,
        sort: 'modified_desc'
      });

      return {
        ...category,
        items: articleData.items.map(toArticleListResponse)
      };
    })
  );

  const recentPosts = latestPosts.items.map(toPostListResponse);
  const recentWiki = latestWiki.items.map(toArticleListResponse);

  const studentServicesSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('student service')) ?? null;
  const seniorProjectsSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('senior project')) ?? null;
  const focalPointSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('focal point')) ?? null;

  const topSections: Array<(typeof featuredSections)[number]> = [];
  const usedSlugs = new Set<string>();

  if (studentServicesSection) {
    topSections.push(studentServicesSection);
    usedSlugs.add(studentServicesSection.slug);
  }

  if (seniorProjectsSection && !usedSlugs.has(seniorProjectsSection.slug)) {
    topSections.push(seniorProjectsSection);
    usedSlugs.add(seniorProjectsSection.slug);
  }

  for (const section of featuredSections) {
    if (topSections.length >= 2) {
      break;
    }

    if (usedSlugs.has(section.slug)) {
      continue;
    }

    topSections.push(section);
    usedSlugs.add(section.slug);
  }

  const trailingSection =
    (focalPointSection && !usedSlugs.has(focalPointSection.slug) ? focalPointSection : null) ??
    featuredSections.find((section) => !usedSlugs.has(section.slug)) ??
    null;

  return (
    <main className="w-full">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#04060c] text-white">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(58,228,209,0.08),transparent_55%)]" />

        <div className="content-shell relative py-14 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-md border border-white/15 px-3 py-1 text-xs font-semibold tracking-[0.03em] text-white/85">
                Qatar University - College of Engineering
              </p>
              <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
                Computer Science and Engineering Portal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
                Access departmental services, policies, advisement resources, and senior project archives in one
                unified platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md border border-white/15 bg-[#111217] text-white hover:bg-[#1b1d24]"
                >
                  <Link href="/wiki">Browse Wiki</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md bg-[#2CAD9E] text-white hover:bg-[#26998d]"
                >
                  <Link href="/posts">Browse Articles</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md border-[#2CAD9E]/60 bg-transparent text-white hover:bg-[#2CAD9E]/15 hover:text-white"
                >
                  <Link href="/wiki?sort=modified_desc">Latest Updates</Link>
                </Button>
              </div>

              <p className="mt-8 text-sm text-white/70">
                Last successful sync:{' '}
                <span className="font-semibold text-white">{formatDate(meta.lastSuccessAt?.toISOString() ?? null)}</span>
              </p>
            </div>

            <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-[#2CAD9E]/25 bg-black p-6 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
              <Image
                src="/about-us-logo.png"
                alt="ACM Qatar University logo"
                width={460}
                height={460}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </div>

        <div className="absolute right-6 bottom-6 hidden lg:block">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-white/20 bg-black/50 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/api/v1/wiki/categories">All Categories</Link>
          </Button>
        </div>
      </section>

      <section className="content-shell pt-6">
        <div className="overflow-hidden rounded-2xl border border-foreground/12 bg-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Explore CSE Content</h2>
              <p className="mt-1 text-sm text-foreground/70">One surface for key topics, recent wiki edits, and latest blog posts.</p>
            </div>
            <Button asChild variant="outline" className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10">
              <Link href="/wiki">Browse All Wiki Pages</Link>
            </Button>
          </div>

          <Separator className="bg-foreground/10" />

          <div className="grid lg:grid-cols-2">
            {topSections.map((section, index) => (
              <div
                key={section.slug}
                className={`p-6 sm:p-8 ${index === 0 ? 'border-b border-foreground/10 lg:border-r lg:border-b-0' : 'border-b border-foreground/10'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-3.5 w-3.5 rounded-full ${sectionDotClass(section.displayName)}`} />
                  <h3 className="text-2xl font-semibold tracking-tight">{section.displayName}</h3>
                </div>

                <div className="mt-5 space-y-2.5">
                  {section.items.length === 0 ? (
                    <p className="text-sm text-foreground/70">No links synced for this section yet.</p>
                  ) : (
                    section.items.slice(0, 5).map((article) => (
                      <p key={article.id} className="leading-relaxed">
                        <Link href={`/wiki/${article.slug}`} className={CONTENT_LINK_CLASS}>
                          <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          <span>{article.title}</span>
                        </Link>
                      </p>
                    ))
                  )}
                </div>

                <div className="mt-5">
                  <Button
                    asChild
                    variant="outline"
                    className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10"
                  >
                    <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`}>
                      Show all {section.articleCount} in {section.displayName}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2">
            <div className="border-b border-foreground/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Recent Updates</h3>
                  <p className="text-sm text-foreground/70">Most recently modified wiki pages.</p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10"
                >
                  <Link href="/wiki">All Wiki Pages</Link>
                </Button>
              </div>

              <div className="space-y-2.5">
                {recentWiki.slice(0, 7).map((article) => (
                  <p key={article.id} className="leading-relaxed">
                    <Link href={`/wiki/${article.slug}`} className={CONTENT_LINK_CLASS}>
                      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>{article.title}</span>
                    </Link>
                  </p>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-5">
                <h3 className="text-2xl font-semibold tracking-tight">Blog Posts</h3>
                <p className="text-sm text-foreground/70">Latest announcements and departmental news.</p>
                <p className="mt-1 text-xs text-foreground/60">
                  Last sync: {formatDate(meta.lastSuccessAt?.toISOString() ?? null)}
                </p>
              </div>

              <div className="space-y-2.5">
                {recentPosts.length === 0 ? (
                  <p className="text-sm text-foreground/70">No posts available yet.</p>
                ) : (
                  recentPosts.slice(0, 6).map((post) => (
                    <p key={post.id} className="leading-relaxed">
                      <Link href={`/posts/${post.slug}`} className={CONTENT_LINK_CLASS}>
                        <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        <span>{post.title}</span>
                      </Link>
                    </p>
                  ))
                )}
              </div>

              <div className="pt-5">
                <Button
                  asChild
                  variant="outline"
                  className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10"
                >
                  <Link href="/posts">Open Posts Archive</Link>
                </Button>
              </div>
            </div>
          </div>

          {trailingSection ? (
            <>
              <Separator className="bg-foreground/10" />

              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-3.5 w-3.5 rounded-full ${sectionDotClass(trailingSection.displayName)}`} />
                  <h3 className="text-2xl font-semibold tracking-tight">{trailingSection.displayName}</h3>
                </div>

                <div className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {trailingSection.items.length === 0 ? (
                    <p className="text-sm text-foreground/70">No links synced for this section yet.</p>
                  ) : (
                    trailingSection.items.slice(0, 6).map((article) => (
                      <p key={article.id} className="leading-relaxed">
                        <Link href={`/wiki/${article.slug}`} className={CONTENT_LINK_CLASS}>
                          <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          <span>{article.title}</span>
                        </Link>
                      </p>
                    ))
                  )}
                </div>

                <div className="mt-5">
                  <Button
                    asChild
                    variant="outline"
                    className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10"
                  >
                    <Link href={`/wiki?category=${encodeURIComponent(trailingSection.slug)}`}>
                      Show all {trailingSection.articleCount} in {trailingSection.displayName}
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
