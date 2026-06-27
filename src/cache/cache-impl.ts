import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { existsSync } from 'fs';

export async function restoreFromCache(
  cachePath: string[],
  key: string,
  restoreKeys: string[] = [],
): Promise<string | undefined> {
  const restored = await cache.restoreCache(cachePath, key, restoreKeys);
  if (restored) {
    core.info(`Using cached ${key} from restored through key: ${restored}`);
    return restored;
  }
  return restored;
}

export async function saveToCache(
  cachePath: string[],
  key: string,
): Promise<boolean> {
  let anyExists = false;
  for (const path of cachePath) {
    if (!existsSync(path)) {
      core.info(`Cache path ${path} is missing`);
    } else {
      anyExists = true;
    }
  }

  if (!anyExists) {
    core.warning(
      `No paths from ${cachePath} exist, skip caching for key ${key}`,
    );
    return false;
  }

  try {
    await cache.saveCache(cachePath, key);
    core.info(`Cached key ${key}`);
  } catch (err: any) {
    core.error(`Caching failed for ${key}: ${err.message}`);
    return false;
  }

  return true;
}

/**
 * Generates a cache key
 *
 * Format: {prefix}-{platform-arch?}-{version?}-{postFixes...}
 *
 */
export function generateCacheKey(
  prefix: string,
  version?: string,
  usePlatform = true,
  postFixes: string[] = [],
): string {
  const platform = usePlatform ? `-${process.platform}-${process.arch}` : '';
  const ver = version ? `-${version}` : '';
  const postfix = postFixes.length > 0 ? `-${postFixes.join('-')}` : '';
  return `${prefix}${platform}${ver}${postfix}`;
}

export async function deleteCacheEntry(key: string) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    core.warning('No GitHub token; cannot delete cache entry');
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    core.warning('GITHUB_REPOSITORY not set');
    return;
  }
  const [owner, repoName] = repo.split('/');

  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/caches?key=${encodeURIComponent(key)}`;
  try {
    core.info(`Deleting cache entry for key ${key} at ${url}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.ok) {
      core.info(`Deleted cache entry for key ${key}`);
    } else {
      const body = await res.text();
      core.warning(
        `Failed to delete cache entry ${key}: ${res.status} ${body}`,
      );
    }
  } catch (error: any) {
    core.error(`Error deleting cache entry ${key}: ${error.message}`);
  }
}
