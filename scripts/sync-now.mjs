import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_MS = 2_000;

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    return;
  }

  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separator + 1);
    process.env[key] = parseEnvValue(rawValue);
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function parseIntFromEnv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} response is not an object`);
  }

  return value;
}

function isRunTerminal(latestRun) {
  return Boolean(latestRun && latestRun.finishedAt && latestRun.status !== 'running');
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const baseUrl = (process.env.SYNC_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const syncSecret = process.env.SYNC_SECRET;
  const timeoutMs = parseIntFromEnv(process.env.SYNC_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const pollMs = parseIntFromEnv(process.env.SYNC_POLL_MS, DEFAULT_POLL_MS);

  if (!syncSecret) {
    throw new Error('SYNC_SECRET is required (set it in .env.local or environment)');
  }

  console.log(`[sync] Base URL: ${baseUrl}`);
  console.log('[sync] Triggering manual sync...');

  const trigger = await requestJson(`${baseUrl}/api/internal/sync/run`, {
    method: 'POST',
    headers: {
      'x-sync-secret': syncSecret
    }
  });

  if (!trigger.ok) {
    throw new Error(`[sync] Trigger failed (${trigger.status}): ${formatJson(trigger.body)}`);
  }

  const triggerBody = assertObject(trigger.body, 'Trigger');
  const triggerStatus = triggerBody.status;
  const requestedRunId = typeof triggerBody.runId === 'number' ? triggerBody.runId : null;

  console.log(`[sync] Trigger response: ${formatJson(triggerBody)}`);

  if (triggerStatus !== 'success' && triggerStatus !== 'skipped') {
    throw new Error(`[sync] Unexpected trigger status: ${String(triggerStatus)}`);
  }

  console.log('[sync] Polling sync status...');

  const start = Date.now();
  let statusBody;

  while (Date.now() - start < timeoutMs) {
    const statusResp = await requestJson(`${baseUrl}/api/internal/sync/status`, {
      headers: {
        'x-sync-secret': syncSecret
      }
    });

    if (!statusResp.ok) {
      throw new Error(`[sync] Status check failed (${statusResp.status}): ${formatJson(statusResp.body)}`);
    }

    statusBody = assertObject(statusResp.body, 'Status');
    const latestRun = statusBody.latestRun && typeof statusBody.latestRun === 'object' ? statusBody.latestRun : null;

    if (latestRun) {
      const latestRunId = typeof latestRun.id === 'number' ? latestRun.id : null;
      const latestStatus = latestRun.status;
      const finishedAt = latestRun.finishedAt;
      console.log(
        `[sync] latestRun id=${String(latestRunId)} status=${String(latestStatus)} finishedAt=${String(finishedAt)}`
      );

      const matchingRun = requestedRunId === null || latestRunId === requestedRunId;
      if (matchingRun && isRunTerminal(latestRun)) {
        break;
      }
    } else {
      console.log('[sync] latestRun unavailable yet, retrying...');
    }

    await sleep(pollMs);
  }

  if (!statusBody) {
    throw new Error('[sync] Unable to retrieve sync status');
  }

  const latestRun = statusBody.latestRun && typeof statusBody.latestRun === 'object' ? statusBody.latestRun : null;
  if (!isRunTerminal(latestRun)) {
    throw new Error(`[sync] Timed out after ${timeoutMs}ms waiting for sync completion`);
  }

  if (latestRun.status !== 'success') {
    throw new Error(`[sync] Sync ended with status=${String(latestRun.status)}: ${formatJson(latestRun)}`);
  }

  const [metaResp, healthResp, articlesResp, postsResp] = await Promise.all([
    requestJson(`${baseUrl}/api/v1/wiki/meta`),
    requestJson(`${baseUrl}/api/health`),
    requestJson(`${baseUrl}/api/v1/wiki/articles?page=1&pageSize=1`),
    requestJson(`${baseUrl}/api/v1/posts?page=1&pageSize=1`)
  ]);

  if (!metaResp.ok) {
    throw new Error(`[sync] Meta check failed (${metaResp.status}): ${formatJson(metaResp.body)}`);
  }

  if (!healthResp.ok) {
    throw new Error(`[sync] Health check failed (${healthResp.status}): ${formatJson(healthResp.body)}`);
  }

  if (!articlesResp.ok) {
    throw new Error(`[sync] Article check failed (${articlesResp.status}): ${formatJson(articlesResp.body)}`);
  }

  if (!postsResp.ok) {
    throw new Error(`[sync] Post check failed (${postsResp.status}): ${formatJson(postsResp.body)}`);
  }

  const articleBody = assertObject(articlesResp.body, 'Articles');
  const postBody = assertObject(postsResp.body, 'Posts');
  const totalArticles = typeof articleBody.total === 'number' ? articleBody.total : null;
  const totalPosts = typeof postBody.total === 'number' ? postBody.total : null;

  console.log('[sync] Completed successfully.');
  console.log(`[sync] Total articles in API: ${String(totalArticles)}`);
  console.log(`[sync] Total posts in API: ${String(totalPosts)}`);
  console.log(`[sync] Meta: ${formatJson(metaResp.body)}`);
  console.log(`[sync] Health: ${formatJson(healthResp.body)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
