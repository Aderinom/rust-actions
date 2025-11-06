import { error, group, info, setFailed } from '@actions/core';
import { exec } from '@actions/exec';
import { warn } from 'node:console';
import { homedir } from 'node:os';
import path from 'node:path';
import { buildCacheStrategy } from './build-cache.js';
import { Cargo } from './cargo.js';
import { Input } from './input.js';
import {
  getGlobalDefaultToolchain,
  prepareToolchain,
  setDefaultToolchain,
} from './rustup.js';
import {
  ClippyWorkflow,
  DenyWorkflow,
  DocsWorkflow,
  FormatWorkflow,
  ShearWorkflow,
  TestWorkflow,
  Workflow,
  workflowConfig,
} from './workflows.js';

interface RunResult {
  installedToolchains: string[];
  installedTools: [string, string][];
  workflowResults: Record<string, true | string>;
  succeeded: boolean;
}

// Default workflows to run if 'all' is specified
const all_default = ['fmt', 'clippy', 'shear', 'test', 'doc'];

// Main function to run selected workflows
//
// Returns true if all workflows succeeded, false otherwise
export async function run(cfg: Input): Promise<RunResult> {
  const start = Date.now();
  info(`cwd: ${process.cwd()}`);
  info(`project path: ${cfg.project}`);
  info(`cargo home: ${Cargo.cargoHome()}`);
  info(`rustup home: ${Cargo.rustupHome()}`);
  info(`target dir: ${Cargo.targetDir(cfg.project)}`);

  // print rustup show
  await exec('rustup', ['show']);

  // Check for rust-toolchain.toml and override toolchain if necessary
  const tomlChannel = await Cargo.rustToolchainTomlChannel(cfg.project);
  if (tomlChannel) {
    info(`Detected rust-toolchain.toml channel: ${tomlChannel}`);
    if (cfg.toolchain) {
      warn(
        `Global toolchain is set to '${cfg.toolchain}', but rust-toolchain.toml specifies '${tomlChannel}'. Overriding global toolchain.`,
      );
    }

    cfg.toolchain = tomlChannel;
  }

  const cacheKey = cfg.cacheKey === 'no-cache' ? undefined : 'rax-cache';

  // Ensure default toolchain is set to allow rustc -vV calls
  if ((await getGlobalDefaultToolchain()) === undefined) {
    await setDefaultToolchain(cfg.toolchain || 'stable');
  }

  const enabledWorkflows = [
    new FormatWorkflow(workflowConfig(cfg, 'fmt')),
    new ClippyWorkflow(workflowConfig(cfg, 'clippy')),
    new ShearWorkflow(workflowConfig(cfg, 'shear')),
    new TestWorkflow(workflowConfig(cfg, 'test')),
    new DocsWorkflow(workflowConfig(cfg, 'doc')),
    new DenyWorkflow(workflowConfig(cfg, 'deny')),
  ].filter((wf) => workflowFilter(cfg, wf.name));

  // Prepare toolchains
  const installedToolchains: string[] = await installToolchains(
    cfg,
    enabledWorkflows,
    start,
    cacheKey,
  );

  const installedTools: [string, string][] = await installTools(
    start,
    enabledWorkflows,
    cacheKey,
    cfg,
  );

  // If installOnly is set, skip workflow execution
  if (cfg.installOnly) {
    info('Install-only mode enabled, skipping workflow execution.');
    return {
      installedToolchains,
      installedTools,
      workflowResults: {},
      succeeded: true,
    };
  }

  const buildCache = buildCacheStrategy(
    cfg.project,
    cfg.buildCacheStrategy,
    installedToolchains,
    cfg.buildCacheFallbackBranch,
  );

  if (buildCache) {
    await group(`Restoring build cache: ${timeSinceStart(start)}`, async () => {
      await buildCache.restore();
    });
  }

  // Run workflows
  const workflowResults: Record<string, true | string> = {};
  let failingWorkflows: string[] = [];
  let allSucceeded = true;
  for (const wf of enabledWorkflows) {
    await group(`${wf.name}: ${timeSinceStart(start)}`, async () => {
      try {
        await wf.run();
        workflowResults[wf.name] = true;
      } catch (e) {
        allSucceeded = false;
        setFailed(`Workflow ${wf.name} failed: ${e}`);
        failingWorkflows.push(wf.name);
        workflowResults[wf.name] = e instanceof Error ? e.message : `${e}`;
      }
    });
  }

  if (buildCache) {
    await group(`Saving build cache: ${timeSinceStart(start)}`, async () => {
      await buildCache.save();
    });
  }

  info(`Finished after: ${timeSinceStart(start)}`);

  if (!allSucceeded) {
    error(`The following workflows failed:`);
    for (const wf of failingWorkflows) {
      error(` - ${wf}`);
    }
  }

  return {
    installedToolchains,
    installedTools,
    workflowResults,
    succeeded: allSucceeded,
  };
}

async function installTools(
  start: number,
  enabledWorkflows: Workflow[],
  cacheKey: string | undefined,
  cfg: Input,
) {
  const installedTools: [string, string][] = [];
  // Installation of required tools for enabled workflows
  await group(`Installing tools: ${timeSinceStart(start)}`, async () => {
    for (const wf of enabledWorkflows) {
      for (const [tool, version] of wf.requiredTools) {
        await Cargo.install(tool, version, cacheKey);
        installedTools.push([tool, version]);
      }
    }

    if (cfg.installAdditional) {
      for (const toolSpec of cfg.installAdditional) {
        // Split toolSpec into tool and version (default to 'latest' if no version specified)
        const [tool, version] = toolSpec.split('@');
        await Cargo.install(tool, version || 'latest', cacheKey);
        installedTools.push([tool, version || 'latest']);
      }
    }
  });
  return installedTools;
}

async function installToolchains(
  cfg: Input,
  enabledWorkflows: Workflow[],
  start: number,
  cacheKey: string | undefined,
) {
  const toolchainsToInstall = new Set<string>();
  if (cfg.toolchain) {
    toolchainsToInstall.add(cfg.toolchain);
  }
  let needDefaultToolchain = false;
  for (const flow of enabledWorkflows) {
    if (flow.config.toolchain) {
      toolchainsToInstall.add(flow.config.toolchain);
    } else {
      needDefaultToolchain = true;
    }
  }
  if (needDefaultToolchain && cfg.toolchain) {
    toolchainsToInstall.add(cfg.toolchain);
  }

  const installedToolchains: string[] = [];
  // Prepare all required toolchains
  for (const tc of toolchainsToInstall) {
    await prepareToolchain(start, tc, cfg.extraComponents, cacheKey);
    installedToolchains.push(tc);
  }
  return installedToolchains;
}

// Ensures that Cargo's bin directory is in PATH
export function addCargoToPath(): void {
  const cargoHome = process.env.CARGO_HOME
    ? process.env.CARGO_HOME
    : process.platform === 'win32'
      ? path.join(process.env.USERPROFILE || '', '.cargo')
      : path.join(homedir() || '', '.cargo');
  const cargoBin = path.join(cargoHome, 'bin');
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
}

export function timeSinceStart(start: number): string {
  const duration = Date.now() - start;
  if (duration < 1000) {
    // ms format
    return `${duration}ms`;
  } else if (duration < 60_000) {
    // ss format
    return `${(duration / 1000).toFixed(0)}s`;
  } else {
    // mm:ss format
    const minutes = Math.floor(duration / 60_000);
    const seconds = ((duration % 60_000) / 1000).toFixed(0).padStart(2, '0');
    return `${minutes}m:${seconds}s`;
  }
}

function workflowFilter(cfg: Input, flow: string): boolean {
  let runfilter = cfg.run.flatMap((r) => {
    if (r === 'all-default') {
      return all_default;
    } else {
      return [r];
    }
  });

  return runfilter.includes(flow);
}
