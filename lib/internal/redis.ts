import { Redis } from '@upstash/redis';

import { getUpstashRedisRestToken, getUpstashRedisRestUrl } from '@/lib/internal/env';
import { log } from '@/lib/internal/log';

declare global {
  // eslint-disable-next-line no-var
  var __upstashRedisClient: Redis | undefined;
  // eslint-disable-next-line no-var
  var __upstashRedisWarningShown: boolean | undefined;
}

function warnRedisNotConfigured(): void {
  if (global.__upstashRedisWarningShown) {
    return;
  }

  global.__upstashRedisWarningShown = true;
  log('info', 'upstash.redis.disabled', {
    reason: 'missing_credentials',
    required_env: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
  });
}

export function isUpstashRedisConfigured(): boolean {
  return Boolean(getUpstashRedisRestUrl() && getUpstashRedisRestToken());
}

export function getRedisClient(): Redis | null {
  const url = getUpstashRedisRestUrl();
  const token = getUpstashRedisRestToken();

  if (!url || !token) {
    warnRedisNotConfigured();
    return null;
  }

  if (!global.__upstashRedisClient) {
    global.__upstashRedisClient = new Redis({ url, token });
  }

  return global.__upstashRedisClient;
}
