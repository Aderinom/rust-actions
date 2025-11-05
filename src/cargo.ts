import * as core from '@actions/core';
import * as actionexec from '@actions/exec';
import * as http from '@actions/http-client';
import * as io from '@actions/io';
import { warn } from 'console';
import { existsSync, readFileSync } from 'fs';
import { homedir, platform } from 'os';
import path from 'path';
import { cwd } from 'process';
import * as toml from 'toml';
import { ensureBinstall } from './binstall';
import { generateCacheKey, restoreFromCache, saveToCache } from './cache';
import { spawnAsync } from './util';

export class Cargo {
  /**
   * @returns Path to cargo target directory
   */
  public static targetDir(projectDir: string): string {
    return process.env.CARGO_TARGET_DIR || path.join(projectDir, 'target');
  }

  /**
   * @returns Path to cargo binary directory
   */
  public static binDir(): string {
    const cargoHome = Cargo.cargoHome();
    return path.join(cargoHome, 'bin');
  }

  public static cargoHome(): string {
    return process.env.CARGO_HOME || path.join(homedir() || '', '.cargo');
  }

  /**
   * @returns Path to rustup home directory
   */
  public static rustupHome(): string {
    return process.env.RUSTUP_HOME || path.join(homedir() || '', '.rustup');
  }

  public static cargoLock(projectDir: string): string {
    return path.join(projectDir, 'Cargo.lock');
  }

  public static async rustToolchainTomlChannel(
    dir: string = cwd(),
  ): Promise<string | undefined> {
    if (!existsSync(path.join(dir, 'rust-toolchain.toml'))) {
      core.debug('No rust-toolchain.toml found');
      return;
    }

    let tomlContent: any;
    try {
      const toolchainToml = path.join(dir, 'rust-toolchain.toml');
      const content = await readFileSync(toolchainToml, 'utf8');
      tomlContent = toml.parse(content);
    } catch (error) {
      warn('Failed to parse rust-toolchain.toml.');
      return;
    }

    let channel = tomlContent?.toolchain?.channel;
    if (typeof channel !== 'string') {
      return;
    }

    // Remove any suffixes like "-2024-01-01" from the channel
    return channel;
  }

  /**
   * Ensures a cargo-installed binary exists. If not, installs it using cargo or cargo-binstall.
   * Optionally restores/saves to cache.
   *
   * @param program Program name (e.g. "cargo-nextest")
   * @param version Version or "latest"
   * @param cachePrefix Cache key prefix (omit or "no-cache" to skip caching)
   * @param restoreKeys Optional list of restore keys
   * @param useBinstall Use cargo-binstall if true
   */
  public static async install(
    program: string,
    version = 'latest',
    cachePrefix?: string,
    useBinstall = true,
  ): Promise<void> {
    const cargoBin = await io.which('cargo', true);
    const binDir = Cargo.binDir();
    let cachePath: string[];

    if (process.platform === 'win32') {
      cachePath = [path.join(binDir, `${program}.exe`)];
    } else {
      cachePath = [path.join(binDir, program)];
    }

    const cachePrefixFinal =
      cachePrefix !== 'no-cache' ? cachePrefix : undefined;

    // Helper to check if program is already installed
    async function isInstalled(): Promise<boolean> {
      try {
        await io.which(program, true);
        return true;
      } catch {
        return false;
      }
    }

    // Helper to resolve latest version from crates.io
    async function resolveVersion(crate: string): Promise<string> {
      if (version && version !== 'latest') return version;
      const client = new http.HttpClient('rust-all-action');
      const url = `https://crates.io/api/v1/crates/${crate}`;
      const resp: any = await client.getJson(url);
      if (!resp.result) throw new Error('Unable to fetch latest crate version');
      return resp.result.crate.newest_version;
    }

    // Check if already installed
    if (await isInstalled()) {
      core.debug(`${program} already installed`);
      return;
    }

    // Restore from cache
    const resolvedVersion = await resolveVersion(program);
    const cacheKey = cachePrefixFinal
      ? generateCacheKey(
          `${cachePrefixFinal}-${program}`,
          resolvedVersion,
          true,
        )
      : undefined;

    if (cacheKey && (await restoreFromCache(cachePath, cacheKey))) return;

    // If binstall requested, ensure it's installed
    if (useBinstall) {
      await ensureBinstall(cachePrefixFinal);
    }

    // Install the program
    await core.group(
      `${useBinstall ? 'binstall' : 'install'} ${program}@${resolvedVersion}`,
      async () => {
        const args =
          useBinstall === true ? ['binstall', '--no-confirm'] : ['install'];
        if (resolvedVersion && resolvedVersion !== 'latest') {
          args.push('--version', resolvedVersion);
        }
        args.push(program);

        await actionexec.exec(cargoBin, args);
      },
    );

    // Save to cache
    if (cacheKey) await saveToCache(cachePath, cacheKey);
    return;
  }

  // Executes a cargo command with given arguments
  public static async exec(
    args: string[],
    options?: Omit<actionexec.ExecOptions, 'stdio'>,
  ): Promise<void> {
    if (platform() === 'win32') {
      // On Windows, we have to use powershell because otherwise env vars are not recignized by cargo
      await spawnAsync('cargo', args, {
        ...options,
        shell: 'bash',
        stdio: 'inherit',
        env: process.env as any,
      });
    } else {
      await actionexec.exec('cargo', args, {
        ...options,
        env: process.env as any,
      });
    }
  }
}
