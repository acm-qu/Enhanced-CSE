import { withSentryConfig } from '@sentry/nextjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Opt-in self-contained build for hosts without Docker (e.g. cPanel/Passenger).
  // Set BUILD_STANDALONE=1 to emit .next/standalone; unset keeps the Vercel/Docker flow unchanged.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,
  // NOTE: do not add outputFileTracingExcludes here. Its globs are not anchored
  // to the project root, so a pattern like './lib/**' also matches
  // 'node_modules/postcss/lib/**' and silently strips dependencies down to a
  // bare package.json — the app then fails at runtime with "Failed to load
  // external module". The source tree that /api/media drags in (its cache path
  // uses process.cwd(), which the tracer cannot analyse) is pruned from the
  // assembled bundle instead, where the removals are explicit and verifiable.
  // /cs-study-plan was the route's name until the page was reframed around the
  // electives list. Bookmarks and links in synced wiki content still point at it.
  async redirects() {
    return [{ source: '/cs-study-plan', destination: '/electives', permanent: true }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ],
    // sharp is not installed and image optimisation is expensive on shared hosting
    unoptimized: process.env.BUILD_STANDALONE ? true : undefined
  }
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "awdawd-ir",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
