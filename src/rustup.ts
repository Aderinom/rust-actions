import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import * as path from 'path';
import { platform } from 'process';
import { generateCacheKey, restoreFromCache } from './cache';
import { Cargo } from './cargo';
import { timeSinceStart } from './lib';

// Lists installed Rust toolchains
export async function listToolchains(): Promise<string[]> {
  const dir = path.join(Cargo.rustupHome(), 'toolchains');
  try {
    return await readdir(dir);
  } catch (err) {
    throw new Error(`Cannot read toolchains directory: ${err}`);
  }
}

export async function listInstalledComponents(toolchain?: string) {
  const args = ['component', 'list', '--installed'];

  if (toolchain) {
    args.unshift(`+${toolchain}`);
  }

  args.unshift('rustup');
  const ret = execSync(args.join(' '));

  // Parse
  return ret.toString().trim().split('\n');
}

export async function isComponentInstalled(
  component: string,
  toolchain?: string,
): Promise<boolean> {
  const installed = await listInstalledComponents(toolchain);
  // Try to find component in installed list, we ignore the host triple suffix
  return installed.find((c) => c.startsWith(component)) !== undefined;
}

export async function installComponent(
  component: string,
  toolchain?: string,
): Promise<void> {
  const args = ['component', 'add', component];
  if (toolchain) {
    args.unshift(`+${toolchain}`);
  }

  await exec.exec('rustup', args);
}

// Gets the default Rust toolchain or undefined if not set (or command fails)
export async function getGlobalDefaultToolchain(): Promise<string | undefined> {
  try {
    const stdoutBuf = execSync('rustup show active-toolchain', {
      cwd: '/',
    }).toString();
    return stdoutBuf.trim();
  } catch (err) {
    return undefined;
  }
}

export async function setDefaultToolchain(toolchain: string): Promise<void> {
  core.notice(`Setting default toolchain to ${toolchain}`);
  await exec.exec('rustup', ['default', toolchain]);
}

export async function getHostTriple(): Promise<string> {
  const stdoutBuf = execSync('rustc -vV').toString();

  const lines = stdoutBuf.toString().split('\n');
  for (const line of lines) {
    if (line.startsWith('host:')) {
      return line.slice('host:'.length).trim();
    }
  }

  throw new Error('Cannot determine host triple from rustc -vV output');
}

// Saves a Rust toolchain installation to cache
async function saveToCache(toolchainPath: string, key: string): Promise<void> {
  if (!existsSync(toolchainPath)) {
    core.warning(`Expected path ${toolchainPath} missing, skip caching`);
    return;
  }
  try {
    await cache.saveCache([toolchainPath], key);
    core.info(
      `Cached toolchain ${path.basename(toolchainPath)} with key ${key}`,
    );
  } catch (err: any) {
    if (err.name === cache.ValidationError.name) throw err;
    if (err.name === cache.ReserveCacheError.name)
      core.warning(`Caching failed: ${err.message}`);
  }
}

// Prepares the specified Rust toolchain, installing and caching as needed
export async function prepareToolchain(
  startTime: number,
  toolchain: string,
  additionalComponents: string[] = [],
  cachePrefix?: string,
): Promise<void> {
  const ensureComponents = async () => {
    let hadToInstall = false;
    for (const component of additionalComponents) {
      const installed = await isComponentInstalled(component, toolchain);
      if (installed) {
        core.debug(
          `Component ${component} already installed for toolchain ${toolchain}`,
        );
      } else {
        core.info(
          `Installing component ${component} for toolchain ${toolchain}`,
        );
        await installComponent(component, toolchain);
        hadToInstall = true;
      }
    }

    return hadToInstall;
  };

  await core.group(
    `Preparing toolchain ${toolchain}: ${timeSinceStart(startTime)}`,
    async () => {
      let cachePrefixFinal =
        cachePrefix == 'no-cache' ? undefined : cachePrefix;

      if (platform === 'win32') {
        // It's faster to install without caching on Windows
        cachePrefixFinal = undefined;
      }

      const hostTriple = await getHostTriple();
      const toolchains = await listToolchains();
      const toolchainPath = path.join(
        Cargo.rustupHome(),
        'toolchains',
        `${toolchain}-${hostTriple}`,
      );
      const cacheKey = generateCacheKey(
        `${cachePrefixFinal}-${toolchain}-${hostTriple}`,
        undefined,
        false,
      );

      // Check if we have the toolchain already installed
      if (toolchains.some((t) => t.includes(toolchain))) {
        core.debug(`Toolchain ${toolchain} already installed`);
        await ensureComponents();

        // We don't update the cache if we only installed components
        // It's not clear what is already installed
        return;
      }

      // Try restore from cache
      if (
        cachePrefixFinal &&
        (await restoreFromCache([toolchainPath], cacheKey))
      ) {
        core.info(`Restored toolchain ${toolchain} from cache key ${cacheKey}`);

        const hadToInstall = await ensureComponents();
        if (hadToInstall) {
          core.info(
            `Toolchain ${toolchain} had missing components, updating cache`,
          );
          await saveToCache(toolchainPath, cacheKey);
        }

        return;
      }

      // Otherwise install
      core.info(`Installing toolchain ${toolchain}`);
      // To support all components, install with 'default' profile
      await exec.exec('rustup', ['install', toolchain, '--profile', 'default']);
      await ensureComponents();

      if (cachePrefixFinal) {
        await saveToCache(toolchainPath, cacheKey);
        core.info(`Saved toolchain ${toolchain} to cache key ${cacheKey}`);
      }
    },
  );
}
