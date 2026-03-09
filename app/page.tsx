import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toArticleListResponse, toPostListResponse } from '@/lib/content/transform';
import { listPosts } from '@/lib/db/posts-queries';
import { listArticles, listCategories, type TermWithCount } from '@/lib/db/queries';
import HomepageButtons from '@/components/homepage-buttons';

export const revalidate = 28800;

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
  'group inline-flex items-start gap-2 text-[17px] font-semibold leading-relaxed text-[#2CAD9E] transition-colors hover:text-[#3AE4D1]';

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

// ─── Async data slices ────────────────────────────────────────────────────────

async function FeaturedSections() {
  const categories = await listCategories();
  const featuredCategories = pickFeaturedCategories(categories);
  const featuredSections = await Promise.all(
    featuredCategories.map(async (category) => {
      const data = await listArticles({ page: 1, pageSize: 5, categorySlug: category.slug, sort: 'modified_desc' });
      return { ...category, items: data.items.map(toArticleListResponse) };
    })
  );

  const studentServicesSection = featuredSections.find((s) => normalizeText(s.displayName).includes('student service')) ?? null;
  const seniorProjectsSection = featuredSections.find((s) => normalizeText(s.displayName).includes('senior project')) ?? null;
  const focalPointSection = featuredSections.find((s) => normalizeText(s.displayName).includes('focal point')) ?? null;

  const topSections: Array<(typeof featuredSections)[number]> = [];
  const usedSlugs = new Set<string>();
  if (studentServicesSection) { topSections.push(studentServicesSection); usedSlugs.add(studentServicesSection.slug); }
  if (seniorProjectsSection && !usedSlugs.has(seniorProjectsSection.slug)) { topSections.push(seniorProjectsSection); usedSlugs.add(seniorProjectsSection.slug); }
  for (const s of featuredSections) {
    if (topSections.length >= 2) break;
    if (!usedSlugs.has(s.slug)) { topSections.push(s); usedSlugs.add(s.slug); }
  }
  const trailingSection =
    (focalPointSection && !usedSlugs.has(focalPointSection.slug) ? focalPointSection : null) ??
    featuredSections.find((s) => !usedSlugs.has(s.slug)) ?? null;

  return (
    <>
      <div className="grid lg:grid-cols-2">
        {topSections.map((section, index) => (
          <div key={section.slug} className={`p-6 sm:p-8 ${index === 0 ? 'border-b border-foreground/10 lg:border-r lg:border-b-0' : 'border-b border-foreground/10'}`}>
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
              <Button asChild variant="outline" className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10">
                <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`}>
                  Show all {section.articleCount} in {section.displayName}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
      {trailingSection && (
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
              <Button asChild variant="outline" className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10">
                <Link href={`/wiki?category=${encodeURIComponent(trailingSection.slug)}`}>
                  Show all {trailingSection.articleCount} in {trailingSection.displayName}
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

async function RecentUpdatesSection() {
  const latestWiki = await listArticles({ page: 1, pageSize: 8, sort: 'modified_desc' });
  const recentWiki = latestWiki.items.map(toArticleListResponse);
  return (
    <div className="border-b border-foreground/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">Recent Updates</h3>
          <p className="text-sm text-foreground/70">Most recently modified wiki pages.</p>
        </div>
        <Button asChild variant="outline" className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10">
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
  );
}

async function BlogPostsSection() {
  const latestPosts = await listPosts({ page: 1, pageSize: 6, sort: 'published_desc' });
  const recentPosts = latestPosts.items.map(toPostListResponse);
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-5">
        <h3 className="text-2xl font-semibold tracking-tight">Blog Posts</h3>
        <p className="text-sm text-foreground/70">Latest announcements and departmental news.</p>
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
        <Button asChild variant="outline" className="border-foreground/20 bg-transparent hover:border-[#2CAD9E]/60 hover:bg-[#2CAD9E]/10">
          <Link href="/posts">Open Posts Archive</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Shell (renders immediately, data slots stream in) ────────────────────────

function ExploreSection() {
  return (
    <section className="relative z-[1] mx-auto w-full max-w-[96rem] px-2 pt-6 sm:px-3 lg:px-4">
      <div className="overflow-hidden rounded-2xl border border-foreground/12 bg-transparent">
        {/* Header — static */}
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

        {/* Featured categories — slow (listCategories + sub-queries per category) */}
        <Suspense fallback={
          <div className="grid lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={`p-6 sm:p-8 ${i === 0 ? 'border-b border-foreground/10 lg:border-r lg:border-b-0' : 'border-b border-foreground/10'}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-3.5 w-3.5 rounded-full bg-foreground/[0.08] animate-pulse shrink-0" />
                  <SkeletonBar w="w-40" h="h-6" />
                </div>
                <div className="space-y-3">
                  {[90, 70, 80, 65, 75].map((pct, j) => <SkeletonBar key={j} pct={pct} />)}
                </div>
                <div className="mt-5"><SkeletonBar w="w-48" h="h-9" /></div>
              </div>
            ))}
          </div>
        }>
          <FeaturedSections />
        </Suspense>

        <Separator className="bg-foreground/10" />

        {/* Static external link */}
        <a
          href="https://better-qu-schedule.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 border-b border-foreground/10 px-6 py-5 transition-colors hover:bg-[#2CAD9E]/5 sm:px-8"
        >
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Better QU Schedule</h3>
            <p className="mt-0.5 text-sm text-foreground/60">Add your MyQu courses and turn them into a schedule</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground/30 transition-colors group-hover:text-[#2CAD9E]" aria-hidden="true">
            <path d="M7 7h10v10" /><path d="M7 17 17 7" />
          </svg>
        </a>

        {/* Recent updates + blog posts — independent queries, stream in separately */}
        <div className="grid lg:grid-cols-2">
          <Suspense fallback={
            <div className="border-b border-foreground/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="space-y-2"><SkeletonBar w="w-36" h="h-6" /><SkeletonBar w="w-48" /></div>
                <SkeletonBar w="w-28" h="h-9" />
              </div>
              <div className="space-y-3">{[85, 60, 75, 65, 70, 55, 80].map((pct, j) => <SkeletonBar key={j} pct={pct} />)}</div>
            </div>
          }>
            <RecentUpdatesSection />
          </Suspense>

          <Suspense fallback={
            <div className="p-6 sm:p-8">
              <div className="mb-5 space-y-2"><SkeletonBar w="w-32" h="h-6" /><SkeletonBar w="w-56" /></div>
              <div className="space-y-3">{[80, 65, 70, 60, 75, 55].map((pct, j) => <SkeletonBar key={j} pct={pct} />)}</div>
            </div>
          }>
            <BlogPostsSection />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function SkeletonBar({ w, h = 'h-4', pct }: { w?: string; h?: string; pct?: number }) {
  return (
    <div
      className={`${h} ${w ?? ''} rounded-md bg-foreground/[0.08] animate-pulse`}
      style={pct ? { width: `${pct}%` } : undefined}
    />
  );
}

export default function HomePage() {
  return (
    <main className="w-full">
      <section className="relative overflow-hidden border-b border-black/10 bg-[#f5f7f8] text-[#111217] dark:border-white/10 dark:bg-[#04060c] dark:text-white">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(44,173,158,0.12),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(58,228,209,0.08),transparent_55%)]" />

        <div className="content-shell relative py-14 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-md border border-[#373637]/20 px-3 py-1 text-xs font-semibold tracking-[0.03em] text-[#373637]/80 dark:border-white/15 dark:text-white/85">
                Qatar University - College of Engineering
              </p>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-6xl">
                Computer Science and Engineering Portal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#373637]/80 dark:text-white/70">
                Access departmental services, policies, advisement resources, and senior project archives in one
                unified platform.
              </p>
              <HomepageButtons />
            </div>

            <Link href={"https://qu.acm.org"} target='_blank' className="w-full max-w-[420px] rounded-3xl border border-[#2CAD9E]/25 bg-black p-6 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
              <Image
                src="/about-us-logo.png"
                alt="ACM Qatar University logo"
                width={460}
                height={460}
                className="h-auto w-full"
                priority
              />
            </Link>
          </div>
        </div>
      </section>

      <ExploreSection />
    </main>
  );
}
