const DEFAULT_WP_API_BASE = 'http://blogs.qu.edu.qa/cse/wp-json/wp/v2';
const DEFAULT_WP_POST_TYPE = 'epkb_post_type_1';

export function getWpApiBase(): string {
  return (process.env.WP_API_BASE ?? DEFAULT_WP_API_BASE).replace(/\/$/, '');
}

export function getWpPostType(): string {
  return process.env.WP_POST_TYPE ?? DEFAULT_WP_POST_TYPE;
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getSyncSecret(): string {
  return getRequiredEnv('SYNC_SECRET');
}

export function getCronSecret(): string {
  return getRequiredEnv('CRON_SECRET');
}
