import { info, warning } from '@actions/core';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { restoreFromCache, saveToCache } from './cache';
import { Cargo } from './cargo';

// Optimized for keeping dependencies cached between builds
// Uses a fallbackBranch to restore from
// Then saves cache based on Cargo.lock hash or branch name
//
// Advantages:
// - We most of the time restore all dependencies from cache
// - We have one cache entry per updated lock file
// Disadvantages:
// - Every branch will have to rebuild changes to internal dependencies

function buildCacheKey(
  projectDir: string,
  toolchains: string[],
  fallbackBranch: string,
): string {
  const lockFile = Cargo.cargoLock(projectDir);
  let lockHashOrBranch = process.env.GITHUB_REF_NAME || 'not-in-gh-action'; //branch

  if (fallbackBranch == lockHashOrBranch) {
    // This branch is the fallback branch, we don't use the lock file hash
  } else if (existsSync(lockFile)) {
    const lockContent = readFileSync(lockFile, 'utf8');
    const hash = createHash('sha256').update(lockContent).digest('hex');
    lockHashOrBranch = hash.slice(0, 20); // use first 20 chars of hash
  }

  const toolchainHash = createHash('sha256')
    .update(toolchains.sort().join(','))
    .digest('hex')
    .slice(0, 8);

  // Normalize project dir to be cache key friendly (e.g. ./my-project -> my-project, /my-project -> my-project, my-project/ -> my-project)
  let normalizedProjectDir = projectDir.trim();
  // Remove leading ./ or / (including repeated ones) and trailing slashes/backslashes
  normalizedProjectDir = normalizedProjectDir
    .replace(/^[./\\]+/, '')
    .replace(/[./\\]+$/, '')
    .replace(/^[/\\]+/, '');

  // If empty (e.g. '.' or './'), fallback to current directory name
  if (!normalizedProjectDir) {
    normalizedProjectDir = 'root';
  }
  // Replace remaining path separators with dashes to avoid nested path issues
  normalizedProjectDir = normalizedProjectDir.replace(/[\\/]+/g, '-');

  const platform = process.platform;
  const arch = process.arch;

  return `rax-cache-build-${platform}-${arch}-${toolchainHash}-${normalizedProjectDir}-${lockHashOrBranch}`;
}

function buildFallbackCacheKey(
  projectDir: string,
  toolchains: string[],
  fallbackBranch: string,
): string {
  const platform = process.platform;
  const arch = process.arch;
  const toolchainHash = createHash('sha256')
    .update(toolchains.sort().join(','))
    .digest('hex')
    .slice(0, 8);

  return `rax-cache-build-${platform}-${arch}-${toolchainHash}-${projectDir}-${fallbackBranch}`;
}

// Restores target folders from cache
export async function restoreBuildCache(
  projectDir: string,
  toolchains: string[],
  fallbackBranch: string,
) {
  const targetDir = Cargo.targetDir(projectDir);
  const cacheKey = buildCacheKey(projectDir, toolchains, fallbackBranch);
  const fallbackKey = buildFallbackCacheKey(
    projectDir,
    toolchains,
    fallbackBranch,
  );

  const restoredKey = await restoreFromCache([targetDir], cacheKey, [
    fallbackKey,
  ]);
  if (restoredKey) {
    console.info(`Restored build cache from key: ${restoredKey}`);
  } else {
    console.info(`No build cache found for keys: ${cacheKey}, ${fallbackKey}`);
  }
}

export async function saveBuildCache(
  projectDir: string,
  toolchains: string[],
  fallbackBranch: string,
) {
  const targetDir = Cargo.targetDir(projectDir);
  const cacheKey = buildCacheKey(projectDir, toolchains, fallbackBranch);
  // TODO: Need to prune the target folder to reduce size

  if (!existsSync(targetDir)) {
    warning(
      `Target directory does not exist: ${targetDir}, skipping cache save.`,
    );
    return;
  }

  await saveToCache([targetDir], cacheKey);

  info(`Saved build cache with key: ${cacheKey}`);
}

export function buildCacheStrategy(
  projectDir: string,
  strategy: string,
  toolchains: string[],
  fallbackBranch: string,
): { restore: () => Promise<void>; save: () => Promise<void> } | undefined {
  switch (strategy) {
    case 'github':
      return {
        restore: async () => {
          await restoreBuildCache(projectDir, toolchains, fallbackBranch);
        },
        save: async () => {
          await saveBuildCache(projectDir, toolchains, fallbackBranch);
        },
      };
    default:
      return undefined;
  }
}
