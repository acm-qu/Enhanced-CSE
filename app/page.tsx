import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  FolderGit2,
  GraduationCap,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench
} from 'lucide-react';
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


function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const FALLBACK_WIKI_ICONS = [BookOpenText, FileText, Sparkles] as const;
const FALLBACK_POST_ICONS = [Newspaper, CalendarDays, Sparkles] as const;

function pickWikiItemIcon(title: string, index: number): LucideIcon {
  const text = normalizeText(title);

  if (text.includes('intern')) return BriefcaseBusiness;
  if (text.includes('elective')) return GraduationCap;
  if (text.includes('cyber')) return ShieldCheck;
  if (text.includes('advisor') || text.includes('coordinator') || text.includes('focal')) return Users;
  if (text.includes('support') || text.includes('technical')) return Wrench;
  if (text.includes('project')) return FolderGit2;

  return FALLBACK_WIKI_ICONS[index % FALLBACK_WIKI_ICONS.length];
}

function pickPostItemIcon(title: string, index: number): LucideIcon {
  const text = normalizeText(title);

  if (text.includes('contest') || text.includes('hackathon') || text.includes('award') || text.includes('demo')) {
    return Sparkles;
  }

  return FALLBACK_POST_ICONS[index % FALLBACK_POST_ICONS.length];
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

  const SECTION_ACCENTS = [
    { gradient: 'from-blue-500 to-cyan-400', glow: 'bg-blue-500/20' },
    { gradient: 'from-violet-500 to-pink-500', glow: 'bg-violet-500/20' },
    { gradient: 'from-orange-500 to-amber-400', glow: 'bg-orange-500/20' }
  ] as const;

  const studentServicesSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('student service')) ?? null;
  const seniorProjectsSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('senior project')) ?? null;
  const focalPointSection =
    featuredSections.find((section) => normalizeText(section.displayName).includes('focal point')) ?? null;

  const remainingSections = featuredSections.filter(
    (section) => section !== studentServicesSection && section !== seniorProjectsSection && section !== focalPointSection
  );

  const firstRowSections = [studentServicesSection, seniorProjectsSection].filter(Boolean) as typeof featuredSections;
  while (firstRowSections.length < 2 && remainingSections.length > 0) {
    firstRowSections.push(remainingSections.shift()!);
  }

  const trailingSection = focalPointSection ?? remainingSections.shift() ?? null;

  return (
    <main className="w-full">
      {/* ── HERO ── */}
      <section className="relative min-h-[50vh] border-b border-foreground/10">
        <div className="absolute inset-0 [background:radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)] dark:[background:radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(127,127,127,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(127,127,127,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto flex min-h-[50vh] w-full max-w-7xl flex-col px-4 sm:px-6">
          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <Badge variant="outline" className="mb-4">
                Qatar University - College of Engineering
              </Badge>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
                Computer Science and Engineering Portal
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Access departmental services, policies, advisement resources, and senior project archives in one
                unified platform.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="lg" className="min-w-[170px] justify-center">
                  <Link href="/wiki">Browse Wiki</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-[170px] justify-center">
                  <Link href="/posts">Browse Articles</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-[170px] justify-center">
                  <Link href="/wiki?sort=modified_desc">Latest Updates</Link>
                </Button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl p-6">
              <div className="mx-auto flex max-w-[380px] justify-center">
                <Image
                  src="/QU Logo - Stacked Black.png"
                  alt="Qatar University College of Engineering logo"
                  width={520}
                  height={180}
                  className="h-auto w-full dark:hidden"
                  priority
                />
                <Image
                  src="/QU Logo - Stacked White.png"
                  alt="Qatar University College of Engineering logo"
                  width={520}
                  height={180}
                  className="hidden h-auto w-full dark:block"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-6 bottom-8 hidden lg:block">
          <div className="pointer-events-auto flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/api/v1/wiki/categories">All Categories</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="content-shell">
      {/* ── DISCOVERY PANEL ── */}
      <section className="mt-5">
        <Card className="overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="px-0 pb-6 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">Explore CSE Content</CardTitle>
                <CardDescription className="text-base">
                  One surface for key topics, recent wiki edits, and latest blog posts.
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href="/wiki">Browse All Wiki Pages</Link>
              </Button>
            </div>
          </CardHeader>
          <Separator />

          <CardContent className="p-0">
            <div className="grid">
              <div className="grid lg:grid-cols-2">
                {firstRowSections.map((section, index) => {
                  const accent = SECTION_ACCENTS[index % SECTION_ACCENTS.length];
                  const showRightDivider = index === 0;

                  return (
                    <div
                      key={section.slug}
                      className={[
                        'p-10',
                        showRightDivider ? 'border-b border-border/60 lg:border-r lg:border-b-0' : 'border-b border-border/60'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative h-5 w-5 shrink-0 rounded-full bg-gradient-to-br ${accent.gradient}`}>
                          <div aria-hidden="true" className={`absolute inset-0 rounded-full ${accent.glow} blur-md`} />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-tight">{section.displayName}</h3>
                      </div>

                      <div className="mt-6 space-y-3">
                        {section.items.length === 0 ? (
                          <p className="text-base text-muted-foreground">No links synced for this section yet.</p>
                        ) : (
                          section.items.map((article, articleIndex) => {
                            const ItemIcon = pickWikiItemIcon(article.title, articleIndex);

                            return (
                              <p key={article.id} className="text-base leading-relaxed sm:text-lg">
                                <Link
                                  href={`/wiki/${article.slug}`}
                                  className="inline-flex items-start gap-2.5 text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline"
                                >
                                  <ItemIcon className="mt-1 h-4 w-4 shrink-0 text-blue-400/80" />
                                  <span>{article.title}</span>
                                </Link>
                              </p>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-6">
                        <Button asChild variant="outline" className="h-11 px-5 text-base">
                          <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`}>
                            Show all {section.articleCount} in {section.displayName}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid lg:grid-cols-2">
                <div className="border-b border-border/60 p-10 lg:border-r lg:border-b-0">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Recent Updates</h3>
                      <p className="text-base text-muted-foreground">Most recently modified wiki pages.</p>
                    </div>
                    <Button asChild variant="outline" className="h-11 px-5 text-base">
                      <Link href="/wiki">All Wiki Pages</Link>
                    </Button>
                  </div>
                  <ScrollArea className="h-96 pr-3">
                    <div className="space-y-3">
                      {recentWiki.map((article, articleIndex) => {
                        const ItemIcon = pickWikiItemIcon(article.title, articleIndex);

                        return (
                          <p key={article.id} className="text-base leading-relaxed sm:text-lg">
                            <Link
                              href={`/wiki/${article.slug}`}
                              className="inline-flex items-start gap-2.5 text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline"
                            >
                              <ItemIcon className="mt-1 h-4 w-4 shrink-0 text-blue-400/80" />
                              <span>{article.title}</span>
                            </Link>
                          </p>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-b border-border/60 p-10">
                  <div className="mb-6">
                    <h3 className="text-2xl font-semibold tracking-tight">Blog Posts</h3>
                    <p className="text-base text-muted-foreground">Latest announcements and departmental news.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Last sync: {meta.lastSuccessAt ? formatDate(meta.lastSuccessAt.toISOString(), { timeStyle: 'short' }) : 'Never'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {recentPosts.length === 0 ? (
                      <p className="text-base text-muted-foreground">No posts available yet.</p>
                    ) : (
                      recentPosts.map((post, postIndex) => {
                        const ItemIcon = pickPostItemIcon(post.title, postIndex);

                        return (
                          <p key={post.id} className="text-base leading-relaxed sm:text-lg">
                            <Link
                              href={`/posts/${post.slug}`}
                              className="inline-flex items-start gap-2.5 text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline"
                            >
                              <ItemIcon className="mt-1 h-4 w-4 shrink-0 text-blue-400/80" />
                              <span>{post.title}</span>
                            </Link>
                          </p>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-6">
                    <Button asChild variant="outline" className="h-11 px-5 text-base">
                      <Link href="/posts">Open Posts Archive</Link>
                    </Button>
                  </div>
                </div>
              </div>

              {trailingSection ? (
                <>
                  <Separator />
                  <div className="p-10">
                    <div className="flex items-center gap-3">
                      <div className={`relative h-5 w-5 shrink-0 rounded-full bg-gradient-to-br ${SECTION_ACCENTS[1].gradient}`}>
                        <div
                          aria-hidden="true"
                          className={`absolute inset-0 rounded-full ${SECTION_ACCENTS[1].glow} blur-md`}
                        />
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight">{trailingSection.displayName}</h3>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      {trailingSection.items.length === 0 ? (
                        <p className="text-base text-muted-foreground">No links synced for this section yet.</p>
                      ) : (
                        trailingSection.items.map((article, articleIndex) => {
                          const ItemIcon = pickWikiItemIcon(article.title, articleIndex);

                          return (
                            <p key={article.id} className="text-base leading-relaxed sm:text-lg">
                              <Link
                                href={`/wiki/${article.slug}`}
                                className="inline-flex items-start gap-2.5 text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline"
                              >
                                <ItemIcon className="mt-1 h-4 w-4 shrink-0 text-blue-400/80" />
                                <span>{article.title}</span>
                              </Link>
                            </p>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-6">
                      <Button asChild variant="outline" className="h-11 px-5 text-base">
                        <Link href={`/wiki?category=${encodeURIComponent(trailingSection.slug)}`}>
                          Show all {trailingSection.articleCount} in {trailingSection.displayName}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
      </div>
    </main>
  );
}
