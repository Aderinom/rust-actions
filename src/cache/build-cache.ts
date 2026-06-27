import { error, info, warning } from '@actions/core';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { Cargo } from '../rust/cargo.js';
import { deleteCacheEntry, restoreFromCache, saveToCache } from './cache-impl.js';

export interface BuildCacheStrategy {
  restore(): Promise<void>;
  save(): Promise<void>;
}

export function buildCacheStrategy(
  projectDir: string,
  strategy: string,
  toolchains: string[],
  fallbackBranch: string,
  cachePrefix?: string,
): BuildCacheStrategy | undefined {
  if (!cachePrefix) return;

  switch (strategy) {
    case 'github':
      return new GithubBuildCacheStrategy(
        cachePrefix,
        projectDir,
        toolchains,
        fallbackBranch,
      );
    case 'none':
      return undefined;
    default:
      warning(`Unknown build cache strategy: ${strategy}`);
      return undefined;
  }
}

export class GithubBuildCacheStrategy implements BuildCacheStrategy {
  private cacheKey: string;
  private fallbackKey: string;
  private projectDir: string;
  private fallbackBranch: string;

  private restoredFrom: string | undefined;

  constructor(
    cachePrefix: string,
    projectDir: string,
    toolchains: string[],
    fallbackBranch: string,
  ) {
    this.projectDir = projectDir;
    this.fallbackBranch = fallbackBranch;
    this.cacheKey = GithubBuildCacheStrategy.buildCacheKey(
      cachePrefix,
      projectDir,
      toolchains,
      fallbackBranch,
    );
    this.fallbackKey = GithubBuildCacheStrategy.buildFallbackCacheKey(
      cachePrefix,
      projectDir,
      toolchains,
      fallbackBranch,
    );
  }

  async restore(): Promise<void> {
    this.restoredFrom = await GithubBuildCacheStrategy.restoreBuildCache(
      this.projectDir,
      this.cacheKey,
      this.fallbackKey,
    );
  }

  async save(): Promise<void> {
    const currentBranch = process.env.GITHUB_REF_NAME || 'not-in-gh-action';

    // Always save if this is the fallback branch
    // Skip save if no dependencies changed
    if (
      currentBranch !== this.fallbackBranch &&
      this.restoredFrom === this.cacheKey
    ) {
      info(`Build cache dependencies unchanged, skipping save.`);
      return;
    }

    // Remove the fallback cache to update
    if (this.restoredFrom && currentBranch === this.fallbackBranch) {
      try {
        await deleteCacheEntry(this.cacheKey);
      } catch (e) {
        error(`Failed to delete build cache for update: ${e}`);
        return;
      }
    }

    await GithubBuildCacheStrategy.saveBuildCache(
      this.projectDir,
      this.cacheKey,
    );
  }

  static async restoreBuildCache(
    projectDir: string,
    cacheKey: string,
    fallbackKey: string,
  ): Promise<string | undefined> {
    const targetDir = Cargo.targetDir(projectDir);

    const restoredKey = await restoreFromCache([targetDir], cacheKey, [
      fallbackKey,
    ]);

    if (restoredKey) {
      console.info(`Restored build cache from key: ${restoredKey}`);
    } else {
      console.info(
        `No build cache found for keys: ${cacheKey}, ${fallbackKey}`,
      );
    }

    return restoredKey;
  }

  static async saveBuildCache(projectDir: string, cacheKey: string) {
    const targetDir = Cargo.targetDir(projectDir);

    if (!existsSync(targetDir)) {
      warning(
        `Target directory does not exist: ${targetDir}, skipping cache save.`,
      );
      return;
    }

    await saveToCache([targetDir], cacheKey);
    info(`Saved build cache with key: ${cacheKey}`);
  }

  static buildCacheKey(
    cachePrefix: string,
    projectDir: string,
    toolchains: string[],
    fallbackBranch: string,
  ): string {
    const lockFile = Cargo.cargoLock(projectDir);
    let lockHashOrBranch = process.env.GITHUB_REF_NAME || 'not-in-gh-action';

    if (fallbackBranch === lockHashOrBranch) {
      // Use branch name
    } else if (existsSync(lockFile)) {
      const lockContent = readFileSync(lockFile, 'utf8');
      const hash = createHash('sha256').update(lockContent).digest('hex');
      lockHashOrBranch = hash.slice(0, 20);
    }

    const toolchainHash = createHash('sha256')
      .update(toolchains.sort().join(','))
      .digest('hex')
      .slice(0, 8);

    let normalizedProjectDir = projectDir
      .trim()
      .replace(/^[./\\]+/, '')
      .replace(/[./\\]+$/, '')
      .replace(/^[/\\]+/, '');

    if (!normalizedProjectDir) normalizedProjectDir = 'root';
    normalizedProjectDir = normalizedProjectDir.replace(/[\\/]+/g, '-');

    const platform = process.platform;
    const arch = process.arch;

    return `${cachePrefix}-build-${platform}-${arch}-${toolchainHash}-${normalizedProjectDir}-${lockHashOrBranch}`;
  }

  static buildFallbackCacheKey(
    cachePrefix: string,
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

    return `${cachePrefix}-build-${platform}-${arch}-${toolchainHash}-${projectDir}-${fallbackBranch}`;
  }
}
